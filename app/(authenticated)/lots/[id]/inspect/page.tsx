'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Paper,
  Stack,
  Group,
  Text,
  Title,
  Badge,
  Button,
  Alert,
  Image,
  Loader,
  Divider,
  List,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCheck,
  IconRefresh,
  IconFlask,
} from '@tabler/icons-react';
import { CameraCapture } from '@/components/inspection/CameraCapture';
import { ManualUpload } from '@/components/inspection/ManualUpload';
import { validateImage } from '@/lib/inspection/image-validation';

// --- Types ---

type MaterialType = 'RAW_FRUIT' | 'RAW_BOTANICAL' | 'EXTRACT_POWDER';
type InspectionType = 'RAW_MATERIAL' | 'POWDER';

type InspectionStatus = 'PENDING' | 'COMPLETED' | 'ERROR';

interface LotData {
  id: string;
  lot_number: string;
  material_type: MaterialType;
  material_name: string;
  supplier_name: string;
  status: string;
}

interface InspectionRecord {
  id: string;
  lot_id: string;
  inspection_type: InspectionType;
  status: InspectionStatus;
  image_url: string | null;
  annotated_image_url: string | null;
  ai_grade: string | null;
  ai_confidence: number | null;
  ai_details: Record<string, unknown> | null;
  defects_found: Array<{ type: string; count: number; confidence: number }> | null;
  color_score: number | null;
  retry_count: number;
  inspector_id: string | null;
  user_created: string | null;
}

interface AiResult {
  grade: string;
  confidence: number;
  annotated_image_base64?: string;
  defects_found?: Array<{ type: string; count: number; confidence: number }>;
  color_score?: number;
  color_analysis?: Record<string, unknown>;
  details?: Record<string, unknown>;
}

type PageStep = 'loading' | 'error' | 'capture' | 'validating' | 'uploading' | 'analyzing' | 'results';

// --- Helpers ---

function getInspectionType(materialType: MaterialType): InspectionType {
  if (materialType === 'EXTRACT_POWDER') return 'POWDER';
  return 'RAW_MATERIAL';
}

function getGradeColor(grade: string): string {
  const map: Record<string, string> = { A: 'green', B: 'teal', C: 'yellow', D: 'orange', F: 'red' };
  return map[grade] ?? 'gray';
}

// --- Component ---

export default function InspectPage() {
  const params = useParams();
  const router = useRouter();
  const lotId = params.id as string;

  const [step, setStep] = useState<PageStep>('loading');
  const [lot, setLot] = useState<LotData | null>(null);
  const [inspection, setInspection] = useState<InspectionRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [useManualUpload, setUseManualUpload] = useState(false);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [annotatedImageUrl, setAnnotatedImageUrl] = useState<string | null>(null);
  const [maxRetryCount, setMaxRetryCount] = useState<number>(3);
  const [retryLoading, setRetryLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // --- Initialize: fetch lot, system config, current user, and create/resume inspection ---
  useEffect(() => {
    async function initialize() {
      try {
        // 1. Fetch lot data, system config, and current user in parallel
        const [lotRes, configRes, sessionRes] = await Promise.all([
          fetch(`/api/items/lots/${lotId}`, { credentials: 'include' }),
          fetch('/api/items/system_config?limit=1&fields[]=max_retry_count', { credentials: 'include' }),
          fetch('/api/auth/session', { credentials: 'include' }),
        ]);

        if (!lotRes.ok) {
          setErrorMessage(lotRes.status === 404 ? 'Lot not found.' : `Failed to load lot (HTTP ${lotRes.status}).`);
          setStep('error');
          return;
        }
        const lotJson = await lotRes.json();
        const lotData: LotData = lotJson.data ?? lotJson;

        // Parse current user ID from session — use local var so it's available for inspection creation below
        let userId: string | null = null;
        if (sessionRes.ok) {
          const sessionJson = await sessionRes.json();
          userId = sessionJson.data?.user?.id ?? null;
          setCurrentUserId(userId);
        }

        // Parse max_retry_count from system_config
        if (configRes.ok) {
          const configJson = await configRes.json();
          const configData = Array.isArray(configJson.data) ? configJson.data[0] : configJson.data;
          if (configData?.max_retry_count != null) {
            setMaxRetryCount(configData.max_retry_count);
          }
        }

        // 2. If lot is in QC_IN_PROGRESS, check for existing ERROR inspection (retry scenario)
        if (lotData.status === 'QC_IN_PROGRESS') {
          const existingRes = await fetch(
            `/api/items/inspections?filter[lot_id][_eq]=${lotData.id}&filter[status][_eq]=ERROR&sort=-date_created&limit=1`,
            { credentials: 'include' }
          );
          if (existingRes.ok) {
            const existingJson = await existingRes.json();
            const existingData = Array.isArray(existingJson.data) ? existingJson.data : [];
            if (existingData.length > 0) {
              const existingInspection: InspectionRecord = existingData[0];
              setLot(lotData);
              setInspection(existingInspection);
              setErrorMessage(
                existingInspection.ai_details && typeof existingInspection.ai_details === 'object' && 'error' in existingInspection.ai_details
                  ? String(existingInspection.ai_details.error)
                  : 'AI service error occurred during inspection.'
              );
              setStep('error');
              return;
            }
          }
        }

        // 3. Validate lot is in PENDING_QC (for new inspections)
        if (lotData.status !== 'PENDING_QC') {
          setErrorMessage(`This lot is in "${lotData.status.replace(/_/g, ' ')}" status. Inspections can only be started for lots in "PENDING QC" status.`);
          setStep('error');
          return;
        }

        setLot(lotData);

        // 4. Transition lot to QC_IN_PROGRESS before creating inspection
        await fetch(`/api/items/lots/${lotData.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'QC_IN_PROGRESS' }),
        });

        // 5. Create inspection record with inspector_id
        const inspectionType = getInspectionType(lotData.material_type);
        const createRes = await fetch('/api/items/inspections', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lot_id: lotData.id,
            inspection_type: inspectionType,
            status: 'PENDING',
            ...(userId ? { inspector_id: userId } : {}),
          }),
        });

        if (!createRes.ok) {
          const errJson = await createRes.json().catch(() => null);
          const msg = errJson?.errors?.[0]?.message || `Failed to create inspection (HTTP ${createRes.status}).`;
          setErrorMessage(msg);
          setStep('error');
          return;
        }

        const inspJson = await createRes.json();
        const inspData: InspectionRecord = inspJson.data ?? inspJson;
        setInspection(inspData);
        setStep('capture');
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
        setStep('error');
      }
    }

    if (lotId) initialize();
  }, [lotId]);

  // --- Process image: validate, upload, call AI ---
  const processImage = useCallback(async (imageFile: File | Blob) => {
    if (!lot || !inspection) return;

    // Convert Blob to File if needed
    const file = imageFile instanceof File
      ? imageFile
      : new File([imageFile], 'capture.jpg', { type: 'image/jpeg' });

    // Step: Validating
    setStep('validating');
    const validation = await validateImage(file);
    if (!validation.valid) {
      setErrorMessage('Image validation failed:\n' + validation.errors.join('\n'));
      setStep('error');
      return;
    }

    // Step: Uploading
    setStep('uploading');
    try {
      const formData = new FormData();
      formData.append('file', file, file.name || 'inspection-image.jpg');

      const uploadRes = await fetch('/api/files', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!uploadRes.ok) {
        setErrorMessage('Failed to upload image. Please try again.');
        setStep('capture');
        return;
      }

      const uploadJson = await uploadRes.json();
      const uploadedFile = uploadJson.data ?? uploadJson;
      const imageUrl = uploadedFile.id || uploadedFile.filename_disk;

      // Update inspection with image_url
      await fetch(`/api/items/inspections/${inspection.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl }),
      });

      // Step: Analyzing with AI
      setStep('analyzing');
      await callAiService(imageUrl, file);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed.');
      setStep('capture');
    }
  }, [lot, inspection]);

  // --- Call AI service ---
  const callAiService = useCallback(async (imageUrl: string, file: File | Blob) => {
    if (!lot || !inspection) return;

    try {
      // Convert file to base64
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const inspectionType = getInspectionType(lot.material_type);
      const endpoint = inspectionType === 'RAW_MATERIAL' ? '/api/inspect/fruit' : '/api/inspect/powder';

      const requestBody = inspectionType === 'RAW_MATERIAL'
        ? { image_base64: base64, material_type: lot.material_type }
        : { image_base64: base64, material_name: lot.material_name };

      const aiRes = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!aiRes.ok) {
        const errJson = await aiRes.json().catch(() => null);
        const errMsg = errJson?.errors?.[0]?.message || `AI service error (HTTP ${aiRes.status})`;
        const errDetails = errJson?.errors?.[0]?.details || '';

        // Update inspection to ERROR
        await fetch(`/api/items/inspections/${inspection.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'ERROR',
            ai_details: { error: errMsg, details: errDetails, http_status: aiRes.status },
          }),
        });

        setErrorMessage(errMsg);
        setErrorDetails(errDetails);
        setInspection((prev) => prev ? { ...prev, status: 'ERROR' } : prev);
        setStep('error');
        return;
      }

      const aiJson = await aiRes.json();
      const result: AiResult = aiJson.data ?? aiJson;

      // Handle annotated image: upload if base64 provided
      let annotatedUrl: string | null = null;
      if (result.annotated_image_base64) {
        try {
          const annotatedBlob = await fetch(
            `data:image/jpeg;base64,${result.annotated_image_base64}`
          ).then((r) => r.blob());
          const annotatedForm = new FormData();
          annotatedForm.append('file', annotatedBlob, 'annotated-image.jpg');
          const annotatedRes = await fetch('/api/files', {
            method: 'POST',
            credentials: 'include',
            body: annotatedForm,
          });
          if (annotatedRes.ok) {
            const annotatedJson = await annotatedRes.json();
            const annotatedFile = annotatedJson.data ?? annotatedJson;
            annotatedUrl = annotatedFile.id || annotatedFile.filename_disk;
          }
        } catch {
          // Non-critical: annotated image upload failed
        }
      }

      // Update inspection to COMPLETED with results
      const updatePayload: Record<string, unknown> = {
        status: 'COMPLETED',
        ai_grade: result.grade,
        ai_confidence: result.confidence,
        ai_details: result.details || result,
        annotated_image_url: annotatedUrl,
      };

      if (result.defects_found) {
        updatePayload.defects_found = result.defects_found;
      }
      if (result.color_score != null) {
        updatePayload.color_score = result.color_score;
      }

      await fetch(`/api/items/inspections/${inspection.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      setAiResult(result);
      if (annotatedUrl) {
        setAnnotatedImageUrl(`/api/assets/${annotatedUrl}`);
      }
      setInspection((prev) => prev ? { ...prev, status: 'COMPLETED', ai_grade: result.grade, ai_confidence: result.confidence } : prev);
      setStep('results');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'AI analysis failed.');
      setErrorDetails('');
      setStep('error');
    }
  }, [lot, inspection]);

  // --- Retry inspection ---
  const handleRetry = useCallback(async () => {
    if (!inspection || !lot) return;

    const currentRetryCount = inspection.retry_count || 0;

    // Guard: do not retry if already at max
    if (currentRetryCount >= maxRetryCount) {
      setErrorMessage('Maximum retry attempts reached. This lot has been escalated to Manager Review.');
      return;
    }

    setRetryLoading(true);
    setErrorMessage('');
    setErrorDetails('');

    try {
      // Check if stored image exists before incrementing retry_count (Requirement 5.7)
      if (!inspection.image_url) {
        setErrorMessage('Stored image is unavailable. Cannot retry inspection. Admins have been notified.');
        setRetryLoading(false);

        // Notify admins about missing stored image
        try {
          await fetch('/api/items/notifications', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'AI_ERROR',
              title: 'Missing Inspection Image',
              message: `Inspection retry failed for lot ${lot.lot_number}: stored image is unavailable. Inspection ID: ${inspection.id}`,
              reference_type: 'inspections',
              reference_id: inspection.id,
            }),
          });
        } catch {
          // Non-critical: notification creation failed silently
        }
        return;
      }

      // Increment retry_count and set status back to PENDING
      const newRetryCount = currentRetryCount + 1;
      const retryRes = await fetch(`/api/items/inspections/${inspection.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'PENDING',
          retry_count: newRetryCount,
        }),
      });

      if (!retryRes.ok) {
        setErrorMessage('Failed to initiate retry.');
        setRetryLoading(false);
        return;
      }

      setInspection((prev) => prev ? {
        ...prev,
        status: 'PENDING',
        retry_count: newRetryCount,
      } : prev);

      // Re-send the stored image to AI
      setStep('analyzing');

      // Fetch the stored image
      const imgRes = await fetch(`/api/assets/${inspection.image_url}`, { credentials: 'include' });
      if (!imgRes.ok) {
        // Image retrieval failed — notify admins (Requirement 5.7)
        setErrorMessage('Stored image could not be retrieved. Admins have been notified.');

        // Revert inspection status to ERROR since we can't proceed
        await fetch(`/api/items/inspections/${inspection.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'ERROR',
            retry_count: currentRetryCount, // revert retry_count since image was missing
          }),
        });

        setInspection((prev) => prev ? {
          ...prev,
          status: 'ERROR',
          retry_count: currentRetryCount,
        } : prev);

        // Notify admins
        try {
          await fetch('/api/items/notifications', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'AI_ERROR',
              title: 'Inspection Image Retrieval Failed',
              message: `Retry attempt for lot ${lot.lot_number} failed: stored image could not be retrieved. Image URL: ${inspection.image_url}. Inspection ID: ${inspection.id}`,
              reference_type: 'inspections',
              reference_id: inspection.id,
            }),
          });
        } catch {
          // Non-critical: notification creation failed silently
        }

        setStep('error');
        setRetryLoading(false);
        return;
      }

      const imgBlob = await imgRes.blob();
      setRetryLoading(false);
      await callAiService(inspection.image_url, imgBlob);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Retry failed.');
      setStep('error');
      setRetryLoading(false);
    }
  }, [inspection, lot, callAiService, maxRetryCount]);

  // --- Camera capture handler ---
  const handleCameraCapture = useCallback((blob: Blob) => {
    processImage(blob);
  }, [processImage]);

  // --- Manual upload handlers ---
  const handleManualFileSelected = useCallback(() => {
    // No-op: preview is handled by ManualUpload component
  }, []);

  const handleManualSubmit = useCallback((file: File) => {
    processImage(file);
  }, [processImage]);

  // --- Render ---

  // Loading state
  if (step === 'loading') {
    return (
      <Stack align="center" justify="center" h={400}>
        <Loader size="lg" />
        <Text c="dimmed">Preparing inspection...</Text>
      </Stack>
    );
  }

  // Error state (non-AI errors or AI errors with retry)
  if (step === 'error') {
    const isAiError = inspection?.status === 'ERROR';
    const currentRetryCount = inspection?.retry_count || 0;
    const retriesExhausted = currentRetryCount >= maxRetryCount;
    // Requirement 5.1: Show retry button only to the original inspector
    const isOriginalInspector = Boolean(
      currentUserId &&
      inspection &&
      (inspection.inspector_id === currentUserId || inspection.user_created === currentUserId)
    );
    const canRetry = isAiError && !retriesExhausted && isOriginalInspector;

    return (
      <Stack gap="md" maw={700} mx="auto" mt="xl">
        <Group justify="space-between" align="flex-start">
          <Title order={3}>Inspection</Title>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => router.push(`/lots/${lotId}`)}
          >
            Back to Lot
          </Button>
        </Group>

        <Alert
          icon={<IconAlertCircle size={20} />}
          title={isAiError ? 'AI Service Error' : 'Error'}
          color="red"
          variant="light"
        >
          <Stack gap="xs">
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{errorMessage}</Text>
            {errorDetails && (
              <Text size="xs" c="dimmed">{errorDetails}</Text>
            )}
          </Stack>
        </Alert>

        {isAiError && retriesExhausted && isOriginalInspector && (
          <Alert
            icon={<IconAlertCircle size={20} />}
            title="Retries Exhausted"
            color="orange"
            variant="light"
          >
            <Text size="sm">
              All {maxRetryCount} retry attempts have been used. This lot has been automatically escalated to Manager Review.
            </Text>
          </Alert>
        )}

        {isAiError && isOriginalInspector && (
          <Group justify="center" gap="md">
            <Button
              leftSection={<IconRefresh size={16} />}
              onClick={handleRetry}
              disabled={retriesExhausted || retryLoading}
              loading={retryLoading}
              data-testid="retry-inspection-btn"
            >
              {retriesExhausted
                ? 'Retries Exhausted'
                : `Retry Inspection`}
            </Button>
            {!retriesExhausted && (
              <Text size="sm" c="dimmed" data-testid="retry-count-info">
                Retry {currentRetryCount}/{maxRetryCount}
              </Text>
            )}
          </Group>
        )}

        {!isAiError && (
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => router.push(`/lots/${lotId}`)}
          >
            Back to Lot Details
          </Button>
        )}
      </Stack>
    );
  }

  // Validating / Uploading / Analyzing states
  if (step === 'validating' || step === 'uploading' || step === 'analyzing') {
    const messages: Record<string, string> = {
      validating: 'Validating image...',
      uploading: 'Uploading image...',
      analyzing: 'Analyzing with AI service...',
    };
    return (
      <Stack align="center" justify="center" h={400}>
        <Loader size="lg" />
        <Text c="dimmed">{messages[step]}</Text>
        {lot && (
          <Badge variant="light" color="blue">
            {getInspectionType(lot.material_type)} Inspection
          </Badge>
        )}
      </Stack>
    );
  }

  // Results state
  if (step === 'results' && aiResult) {
    const inspectionType = lot ? getInspectionType(lot.material_type) : 'RAW_MATERIAL';
    return (
      <Stack gap="lg" maw={800} mx="auto" mt="md">
        <Group justify="space-between" align="flex-start">
          <Title order={3}>Inspection Results</Title>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => router.push(`/lots/${lotId}`)}
          >
            Back to Lot
          </Button>
        </Group>

        {lot && (
          <Paper p="sm" withBorder>
            <Group gap="md">
              <Text size="sm" fw={500}>{lot.lot_number}</Text>
              <Badge variant="light">{lot.material_type.replace(/_/g, ' ')}</Badge>
              <Text size="sm" c="dimmed">{lot.material_name}</Text>
            </Group>
          </Paper>
        )}

        {/* Grade and Confidence */}
        <Paper p="md" withBorder>
          <Stack gap="sm">
            <Title order={4}>Quality Assessment</Title>
            <Group gap="lg">
              <Stack gap={2} align="center">
                <Text size="xs" c="dimmed" fw={500}>Grade</Text>
                <Badge size="xl" color={getGradeColor(aiResult.grade)} variant="filled">
                  {aiResult.grade}
                </Badge>
              </Stack>
              <Stack gap={2} align="center">
                <Text size="xs" c="dimmed" fw={500}>Confidence</Text>
                <Text size="xl" fw={700}>
                  {(aiResult.confidence * 100).toFixed(1)}%
                </Text>
              </Stack>
              {aiResult.color_score != null && (
                <Stack gap={2} align="center">
                  <Text size="xs" c="dimmed" fw={500}>Color Score</Text>
                  <Text size="xl" fw={700}>
                    {aiResult.color_score.toFixed(2)}
                  </Text>
                </Stack>
              )}
            </Group>
          </Stack>
        </Paper>

        {/* Annotated Image */}
        {annotatedImageUrl && (
          <Paper p="md" withBorder>
            <Stack gap="sm">
              <Title order={4}>Annotated Image</Title>
              <Image
                src={annotatedImageUrl}
                alt="AI annotated inspection image"
                maw={600}
                mah={450}
                fit="contain"
                radius="sm"
              />
            </Stack>
          </Paper>
        )}

        {/* Defects (fruit inspections) */}
        {inspectionType === 'RAW_MATERIAL' && aiResult.defects_found && aiResult.defects_found.length > 0 && (
          <Paper p="md" withBorder>
            <Stack gap="sm">
              <Title order={4}>Defects Found</Title>
              <List spacing="xs" size="sm">
                {aiResult.defects_found.map((defect, idx) => (
                  <List.Item key={idx}>
                    <Group gap="xs">
                      <Text fw={500}>{defect.type}</Text>
                      <Badge size="sm" variant="light">Count: {defect.count}</Badge>
                      <Text size="xs" c="dimmed">
                        ({(defect.confidence * 100).toFixed(0)}% confidence)
                      </Text>
                    </Group>
                  </List.Item>
                ))}
              </List>
            </Stack>
          </Paper>
        )}

        {/* Color Analysis (powder inspections) */}
        {inspectionType === 'POWDER' && aiResult.color_analysis && (
          <Paper p="md" withBorder>
            <Stack gap="sm">
              <Title order={4}>Color Analysis</Title>
              <List spacing="xs" size="sm">
                {Object.entries(aiResult.color_analysis).map(([key, value]) => (
                  <List.Item key={key}>
                    <Group gap="xs">
                      <Text fw={500}>{key.replace(/_/g, ' ')}:</Text>
                      <Text size="sm">{String(value)}</Text>
                    </Group>
                  </List.Item>
                ))}
              </List>
            </Stack>
          </Paper>
        )}

        <Divider />

        <Alert icon={<IconCheck size={16} />} color="green" variant="light" title="Inspection Complete">
          <Text size="sm">
            The AI analysis is complete. The lot will be automatically graded against configured thresholds.
          </Text>
        </Alert>

        <Button
          variant="light"
          leftSection={<IconFlask size={16} />}
          onClick={() => router.push(`/lots/${lotId}`)}
        >
          View Lot Details
        </Button>
      </Stack>
    );
  }

  // Capture state (camera or manual upload)
  return (
    <Stack gap="lg" maw={700} mx="auto" mt="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Title order={3}>Inspection</Title>
          {lot && (
            <Text size="sm" c="dimmed">
              {lot.lot_number} — {lot.material_name}
            </Text>
          )}
        </Stack>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => router.push(`/lots/${lotId}`)}
        >
          Back to Lot
        </Button>
      </Group>

      {lot && (
        <Paper p="sm" withBorder>
          <Group gap="md">
            <Badge variant="light" color="blue">
              {getInspectionType(lot.material_type)} Inspection
            </Badge>
            <Text size="sm" c="dimmed">
              {lot.material_type === 'EXTRACT_POWDER'
                ? 'Powder color analysis'
                : 'Fruit/botanical defect detection'}
            </Text>
          </Group>
        </Paper>
      )}

      {useManualUpload ? (
        <Stack gap="md">
          <ManualUpload
            onFileSelected={handleManualFileSelected}
            onSubmit={handleManualSubmit}
          />
          <Button
            variant="subtle"
            size="xs"
            onClick={() => setUseManualUpload(false)}
          >
            Switch to camera capture
          </Button>
        </Stack>
      ) : (
        <CameraCapture
          onCapture={handleCameraCapture}
          onError={() => {}}
          onFallbackRequest={() => setUseManualUpload(true)}
        />
      )}
    </Stack>
  );
}
