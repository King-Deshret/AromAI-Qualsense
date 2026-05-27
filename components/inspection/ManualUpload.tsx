'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stack, Group, Button, Text, Image, Paper } from '@mantine/core';
import { IconRefresh, IconSend } from '@tabler/icons-react';
import { Upload } from '@/components/ui/upload';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPT_STRING = ACCEPTED_TYPES.join(',');

export interface ManualUploadProps {
  /** Called when a file is selected (before submission) */
  onFileSelected: (file: File) => void;
  /** Called when the user confirms submission */
  onSubmit: (file: File) => void;
}

/**
 * Manual file upload fallback component for inspection image capture.
 * Provides drag-and-drop or file browser upload with image preview
 * and reselect option before submission.
 */
export function ManualUpload({ onFileSelected, onSubmit }: ManualUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Clean up object URL on unmount or when file changes
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const handleFileUpload = useCallback(
    (files: File[], _options: { folder?: string; preset?: string }) => {
      const file = files[0];
      if (!file) return Promise.reject(new Error('No file provided'));

      // Validate file type
      if (!ACCEPTED_TYPES.includes(file.type)) {
        return Promise.reject(
          new Error('Invalid file type. Please select a JPEG, PNG, or WebP image.')
        );
      }

      // Revoke previous object URL if any
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }

      // Create preview URL
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      setPreviewUrl(url);
      setSelectedFile(file);
      onFileSelected(file);

      // Return a mock FileUpload to satisfy the Upload component contract
      return Promise.resolve([
        {
          id: `local-${Date.now()}`,
          filename_download: file.name,
          filename_disk: file.name,
          type: file.type,
          filesize: file.size,
          uploaded_on: new Date().toISOString(),
          uploaded_by: 'current-user',
        },
      ]);
    },
    [onFileSelected]
  );

  const handleChangeImage = useCallback(() => {
    // Revoke current preview URL
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreviewUrl(null);
    setSelectedFile(null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (selectedFile) {
      onSubmit(selectedFile);
    }
  }, [selectedFile, onSubmit]);

  // Show upload zone when no file is selected
  if (!selectedFile || !previewUrl) {
    return (
      <Stack gap="md" data-testid="manual-upload">
        <Upload
          accept={ACCEPT_STRING}
          multiple={false}
          fromUser={true}
          fromUrl={false}
          fromLibrary={false}
          onUploadFiles={handleFileUpload}
        />
        <Text size="xs" c="dimmed" ta="center">
          Accepted formats: JPEG, PNG, WebP
        </Text>
      </Stack>
    );
  }

  // Show preview with reselect and submit options
  return (
    <Stack gap="md" data-testid="manual-upload">
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm" align="center">
          <Image
            src={previewUrl}
            alt="Selected inspection image preview"
            maw={480}
            mah={360}
            fit="contain"
            radius="sm"
            data-testid="image-preview"
          />
          <Text size="sm" c="dimmed" ta="center">
            {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
          </Text>
        </Stack>
      </Paper>

      <Group justify="center" gap="md">
        <Button
          variant="default"
          leftSection={<IconRefresh size={16} />}
          onClick={handleChangeImage}
          data-testid="change-image-btn"
        >
          Change Image
        </Button>
        <Button
          leftSection={<IconSend size={16} />}
          onClick={handleSubmit}
          data-testid="submit-inspection-btn"
        >
          Submit for Inspection
        </Button>
      </Group>
    </Stack>
  );
}

export default ManualUpload;
