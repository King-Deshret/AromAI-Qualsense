# Requirements Document

## Introduction

AromAI QC is a dual-stage AI-powered quality control platform for Sima Arome, a natural extracts manufacturer. The platform enables operators to perform inspections on incoming raw materials and extract powders using automated camera capture, leverages an external AI microservice for defect detection and color grading, and provides QC managers with a review workflow for flagged lots. The system enforces a strict lot lifecycle state machine, role-based access control, comprehensive audit logging, configurable quality thresholds, and a retry mechanism for AI service failures.

The platform consists of two deployable units: a BuildPad App (Unit A — main platform handling UI, data model, RBAC, workflow orchestration, notifications, file storage, and API gateway to Unit B) and a FastAPI AI Microservice (Unit B — handling YOLOv11 inference and OpenCV color analysis). AI algorithm internals are out of scope for this specification.

## Glossary

- **Platform**: The AromAI QC BuildPad application including the Next.js frontend and DaaS backend (Unit A)
- **AI_Service**: The external FastAPI microservice that performs image-based quality inspection via YOLOv11 defect detection and OpenCV HSV color analysis (Unit B)
- **Operator**: A floor worker who creates lots, initiates inspections via camera auto-capture, views own results, and can retry failed inspections
- **QC_Manager**: A supervisor who reviews flagged lots, approves or rejects them, views all results, exports reports, and accesses dashboard analytics
- **Admin**: A system administrator with full permissions including user management, system configuration, QC_Threshold management, and audit log access
- **Lot**: A batch of raw material or extract powder identified by a unique Lot_Number, tracked through a lifecycle State_Machine
- **Inspection**: A quality check performed on a lot consisting of image capture and AI analysis, returning a grade and confidence score
- **Review**: A QC_Manager decision (approve or reject) on a lot in MANAGER_REVIEW status
- **Grade**: A quality classification assigned by the AI_Service: A, B, C, D, or F (A being highest quality)
- **Confidence_Score**: A decimal value between 0.0 and 1.0 representing the AI_Service certainty in its grade assignment
- **QC_Threshold**: A configurable set of parameters per Material_Type defining minimum confidence, pass grade, and maximum color delta for automated pass/fail determination
- **Lot_Number**: A unique identifier in the format LOT-YYYYMMDD-XXXX where XXXX is a zero-padded sequential counter that resets daily
- **State_Machine**: The defined set of lot statuses and valid transitions governing the lot lifecycle
- **Material_Type**: The classification of a lot as RAW_FRUIT, RAW_BOTANICAL, or EXTRACT_POWDER
- **Camera_Auto_Capture**: The primary inspection flow where the device camera scans automatically and posts the captured image to the AI_Service for processing without manual file selection
- **Retry_Count**: A configurable integer (default 3) defining the maximum number of times an inspection can be retried after an AI_Service error
- **DaaS_Cron**: The built-in DaaS scheduled job system used for recurring background tasks such as daily summary emails

## Tech Stack and Deployment

- **Unit A (Platform)**: BuildPad App — Next.js frontend, DaaS backend, Supabase Auth, DaaS Files API, DaaS Cron, in-app notifications
- **Unit B (AI Microservice)**: FastAPI deployed separately (Railway or Render)
- **MCP Tooling**: Kiro spec-driven development
- **Camera**: WebRTC getUserMedia (requires HTTPS in production)

## Requirements

### Requirement 1: Lot Registration

**User Story:** As an Operator, I want to register new lots of incoming materials, so that they enter the quality control pipeline for inspection.

#### Acceptance Criteria

1. WHEN an Operator submits a new lot registration, THE Platform SHALL create a lot record with status PENDING_QC, a unique Lot_Number in the format LOT-YYYYMMDD-XXXX, and the Operator recorded as created_by
2. THE Platform SHALL auto-generate the Lot_Number by combining the current date (YYYYMMDD) with a zero-padded sequential counter (XXXX) that resets daily, supporting a maximum of 9999 lots per day
3. WHEN an Operator submits a lot registration, THE Platform SHALL require the fields: material_type (RAW_FRUIT, RAW_BOTANICAL, or EXTRACT_POWDER), material_name (1 to 200 characters), supplier_name (1 to 200 characters), and quantity_kg
4. THE Platform SHALL validate that quantity_kg is a positive decimal number greater than 0.01 and not exceeding 999999.99, with a maximum of two decimal places
5. IF a lot registration fails validation, THEN THE Platform SHALL return an error message identifying each invalid field and the specific constraint violated, without creating a lot record
6. IF two lot registrations are submitted concurrently on the same day, THEN THE Platform SHALL guarantee unique sequential Lot_Number assignment for each, with no duplicate or skipped counter values
7. IF the daily sequential counter reaches 9999, THEN THE Platform SHALL reject further lot registrations for that day and return an error indicating the daily lot limit has been reached

### Requirement 2: Camera Auto-Capture Inspection Flow

**User Story:** As an Operator, I want the camera to automatically capture and submit images for AI inspection, so that the inspection process is fast and hands-free on the factory floor.

#### Acceptance Criteria

1. WHEN an Operator initiates an inspection for a lot in PENDING_QC status, THE Platform SHALL transition the lot status to QC_IN_PROGRESS and create an inspection record with status PENDING linked to the lot, with only one active inspection allowed per lot at any time
2. WHEN an Operator starts the camera auto-capture flow, THE Platform SHALL access the device camera via WebRTC getUserMedia, display a live preview, and capture the image when the Operator triggers the scan button
3. WHEN the camera captures an image, THE Platform SHALL automatically post the image to the AI_Service for preprocessing and analysis without requiring manual upload confirmation
4. THE Platform SHALL store the captured image via the DaaS Files API and record the image_url on the inspection record before sending to the AI_Service
5. IF the device denies camera permission or the camera is unavailable, THEN THE Platform SHALL display an error message explaining the camera requirement and offer the manual file upload fallback
6. THE Platform SHALL provide a manual file upload fallback option (drag-and-drop or file browser) for situations where camera auto-capture is unavailable or impractical
7. WHEN using the manual upload fallback, THE Platform SHALL display a preview of the selected image and allow the Operator to reselect before submission
8. THE Platform SHALL set the inspection_type based on the lot Material_Type: RAW_MATERIAL for RAW_FRUIT and RAW_BOTANICAL lots, POWDER for EXTRACT_POWDER lots
9. IF the DaaS Files API fails to store the captured image, THEN THE Platform SHALL display an error message, keep the inspection in PENDING status, and allow the Operator to retry the capture

### Requirement 3: Image Validation

**User Story:** As an Operator, I want the platform to validate my inspection images before processing, so that only suitable images are sent for AI analysis.

#### Acceptance Criteria

1. WHEN an image is captured or uploaded for inspection, THE Platform SHALL validate that the image format is JPEG, PNG, or WebP by verifying the file header bytes match the declared format
2. WHEN an image is captured or uploaded for inspection, THE Platform SHALL validate that the image file size does not exceed 10 MB
3. WHEN an image is captured or uploaded for inspection, THE Platform SHALL validate that the image dimensions are at least 640x480 pixels
4. WHEN an image is captured or uploaded for inspection, THE Platform SHALL validate that the image dimensions do not exceed 4096x3072 pixels
5. IF an image fails one or more validation constraints, THEN THE Platform SHALL reject the image and return an error message listing all constraints that were violated
6. IF an image file cannot be decoded as a valid image despite having an accepted file extension, THEN THE Platform SHALL reject the file and return an error message indicating the file is corrupt or unreadable

### Requirement 4: AI Service Integration and Processing

**User Story:** As an Operator, I want the platform to automatically analyze inspection images using AI, so that I receive objective quality grades without manual assessment.

#### Acceptance Criteria

1. WHEN the inspection_type is RAW_MATERIAL, THE Platform SHALL call the AI_Service endpoint POST /api/inspect/fruit with the image encoded as base64 and the lot material_type
2. WHEN the inspection_type is POWDER, THE Platform SHALL call the AI_Service endpoint POST /api/inspect/powder with the image encoded as base64 and the lot material_name
3. WHEN the AI_Service returns HTTP 200 with a valid response body, THE Platform SHALL record the ai_grade, ai_confidence, ai_details (full response payload), defects_found (for fruit inspections), and color_score (for powder inspections) on the inspection record and transition the inspection status to COMPLETED
4. IF the AI_Service returns a non-200 HTTP status code, times out, or is unreachable, THEN THE Platform SHALL transition the inspection status to ERROR, record the HTTP status code or timeout reason on the inspection ai_details field, and keep the lot status as QC_IN_PROGRESS
5. THE Platform SHALL treat inspection status ERROR as a sub-state within QC_IN_PROGRESS — the lot status SHALL remain QC_IN_PROGRESS while retry_count is below the configured maximum, and SHALL only transition away from QC_IN_PROGRESS when either (a) the inspection COMPLETES successfully, or (b) retry_count reaches the maximum and the lot auto-escalates to MANAGER_REVIEW
6. THE Platform SHALL include a health check mechanism that calls GET /api/health on the AI_Service at a configurable interval (default every 60 seconds) to verify availability
7. THE Platform SHALL enforce a configurable response timeout (default 5 seconds) for AI_Service calls, after which the request is treated as a timeout error
8. THE AI_Service SHALL expose API documentation via Swagger/OpenAPI at the /docs endpoint, documenting all inspection endpoints, request/response schemas, and error codes

### Requirement 5: Inspection Retry Mechanism

**User Story:** As an Operator, I want to retry a failed inspection when the AI service encounters an error, so that temporary failures do not permanently block the quality control process.

#### Acceptance Criteria

1. WHEN an inspection has status ERROR, THE Platform SHALL display a "Retry Inspection" button exclusively to the Operator who initiated the inspection
2. WHEN an Operator clicks "Retry Inspection", THE Platform SHALL increment the retry_count on the inspection record, transition the inspection status to PENDING, and re-send the stored image to the appropriate AI_Service endpoint based on inspection_type (POST /api/inspect/fruit for RAW_MATERIAL, POST /api/inspect/powder for POWDER)
3. THE Platform SHALL enforce a configurable maximum retry count (default 3, valid range 1 to 10) per inspection, with retry_count initialized to 0 when the inspection record is created
4. IF the retry_count equals the configured maximum and the AI_Service returns an error or is unreachable on that attempt, THEN THE Platform SHALL immediately transition the inspection status to ERROR, disable the "Retry Inspection" button, and auto-escalate the lot to MANAGER_REVIEW status
5. WHILE an inspection has status ERROR and retry_count is below the configured maximum, THE Platform SHALL keep the lot status as QC_IN_PROGRESS to allow retry attempts
6. WHEN a lot is auto-escalated to MANAGER_REVIEW due to exhausted retries, THE Platform SHALL send an in-app notification and email to all active QC_Manager users indicating the escalation reason is AI_Service failure
7. IF the stored image is unavailable when a retry is attempted, THEN THE Platform SHALL display an error message indicating the image cannot be retrieved, keep the inspection in ERROR status without incrementing retry_count, and notify all active Admin users

### Requirement 6: Automated Lot Grading Against Thresholds

**User Story:** As an Operator, I want the system to automatically determine if a lot passes or fails quality control based on configurable thresholds, so that results are consistent and objective.

#### Acceptance Criteria

1. WHEN an inspection completes with status COMPLETED, THE Platform SHALL compare the ai_grade, ai_confidence, and color_score (for EXTRACT_POWDER lots) against the QC_Threshold configured for the lot Material_Type
2. WHEN the ai_grade meets or exceeds the pass_grade (using the ordering A > B > C > D > F where A is highest) AND the ai_confidence meets or exceeds the min_confidence for the Material_Type AND (for EXTRACT_POWDER lots) the color_score does not exceed the max_color_delta, THE Platform SHALL transition the lot status to QC_PASSED
3. WHEN the ai_grade is below the pass_grade (using the ordering A > B > C > D > F) OR the ai_confidence is below the min_confidence for the Material_Type OR (for EXTRACT_POWDER lots) the color_score exceeds the max_color_delta, THE Platform SHALL transition the lot status to QC_FAILED
4. WHEN a lot transitions to QC_FAILED, THE Platform SHALL within the same operation auto-escalate the lot to MANAGER_REVIEW status and send a notification to all active QC_Manager users indicating the threshold failure reason (which parameter failed and by how much)
5. THE Platform SHALL use the following default QC_Threshold values for each Material_Type unless overridden by an Admin: min_confidence of 0.70, pass_grade of C, and max_color_delta of 15.0
6. IF no QC_Threshold is configured for a lot Material_Type at the time of inspection completion, THEN THE Platform SHALL apply the default QC_Threshold values for grading

### Requirement 7: Manager Review Workflow

**User Story:** As a QC_Manager, I want to review flagged lots and make approve/reject decisions with documented reasoning, so that quality decisions have human oversight and traceability.

#### Acceptance Criteria

1. WHILE a lot is in MANAGER_REVIEW status, THE Platform SHALL display the lot in the QC_Manager review queue with the inspection details, AI grade, confidence score, annotated image, and escalation reason (threshold failure or AI error with exhausted retries)
2. WHEN a QC_Manager approves a lot in MANAGER_REVIEW status, THE Platform SHALL require review notes between 10 and 1000 characters, create a review record with decision APPROVED including the reviewer user_id and timestamp, and transition the lot status to APPROVED
3. WHEN a QC_Manager rejects a lot in MANAGER_REVIEW status, THE Platform SHALL require review notes between 10 and 1000 characters, create a review record with decision REJECTED including the reviewer user_id and timestamp, and transition the lot status to REJECTED
4. WHEN a lot transitions to REJECTED, THE Platform SHALL immediately auto-transition the lot to QUARANTINED status
5. WHEN a lot is approved or rejected, THE Platform SHALL send an in-app notification to the Operator who created the original lot indicating the decision and the lot number
6. WHEN a lot transitions to QUARANTINED, THE Platform SHALL send an in-app notification and email to all active Admin users indicating the lot number and quarantine reason
7. IF a QC_Manager submits an approve or reject decision for a lot that is no longer in MANAGER_REVIEW status, THEN THE Platform SHALL reject the submission and return an error indicating the lot has already been reviewed

### Requirement 8: Lot Lifecycle State Machine Enforcement

**User Story:** As a system stakeholder, I want the platform to enforce valid state transitions for lots, so that the quality control workflow maintains data integrity and process compliance.

#### Acceptance Criteria

1. THE Platform SHALL enforce the following valid lot status transitions: PENDING_QC to QC_IN_PROGRESS (operator initiates inspection), QC_IN_PROGRESS to QC_PASSED (inspection COMPLETED and grade plus confidence pass threshold), QC_IN_PROGRESS to QC_FAILED (inspection COMPLETED and grade or confidence fails threshold), QC_FAILED to MANAGER_REVIEW (auto-escalation, immediate), QC_IN_PROGRESS to MANAGER_REVIEW (retry_count exhausted due to AI_Service error), MANAGER_REVIEW to APPROVED (QC_Manager approves), MANAGER_REVIEW to REJECTED (QC_Manager rejects), and REJECTED to QUARANTINED (auto-transition, immediate)
2. IF a state transition is attempted that is not in the valid transitions list, THEN THE Platform SHALL reject the transition, preserve the lot current status and all field values unchanged, and return an error identifying the current status and the invalid target status
3. THE Platform SHALL record the timestamp of each state transition on the lot record in UTC ISO 8601 format
4. WHEN a state transition is triggered by a user action, THE Platform SHALL record the acting user in the audit log; WHEN a state transition is triggered automatically by the system (auto-escalation from QC_FAILED to MANAGER_REVIEW or auto-transition from REJECTED to QUARANTINED), THE Platform SHALL record the actor as SYSTEM in the audit log
5. THE Platform SHALL treat QC_PASSED, APPROVED, and QUARANTINED as terminal states with no further transitions allowed
6. IF two or more state transitions are attempted concurrently on the same lot, THEN THE Platform SHALL process only the first valid transition and reject subsequent attempts with an error indicating the lot status has changed

### Requirement 9: Role-Based Access Control

**User Story:** As an Admin, I want the platform to enforce role-based permissions, so that users can only access functionality appropriate to their role.

#### Acceptance Criteria

1. THE Platform SHALL enforce three roles: OPERATOR, QC_MANAGER, and ADMIN with hierarchical permissions where ADMIN includes all QC_MANAGER permissions and QC_MANAGER includes all OPERATOR permissions
2. THE Platform SHALL restrict Operators to: creating lots, initiating inspections, retrying failed inspections on lots where the Operator is recorded as created_by, and viewing only lots and inspection results where the Operator is recorded as created_by
3. THE Platform SHALL allow QC_Managers to: review lots in MANAGER_REVIEW status, approve or reject lots in MANAGER_REVIEW status, view all lots and inspection results regardless of creator, export reports, and access dashboard analytics
4. THE Platform SHALL restrict Admin-only functions (user management, system configuration, QC_Threshold management, retry count configuration, and audit log access) to users with the ADMIN role
5. IF a user attempts an action not permitted by their role, THEN THE Platform SHALL deny the request, return an authorization error that does not confirm or deny the existence of the target resource, and return the same error response structure regardless of whether the resource exists
6. WHEN a user's role is changed by an Admin, THE Platform SHALL enforce the updated permissions on the user's next request without requiring the user to re-authenticate
7. THE Platform SHALL enforce role-based permissions on both frontend navigation (hiding or disabling inaccessible UI elements) and backend API endpoints (rejecting unauthorized requests server-side) independently, such that bypassing frontend restrictions does not grant access

### Requirement 10: Audit Logging

**User Story:** As an Admin, I want all significant actions to be recorded in an audit log, so that I can trace who did what and when for compliance and troubleshooting.

#### Acceptance Criteria

1. THE Platform SHALL leverage the DaaS built-in activity logging for all item mutations (create, update, delete) across all collections
2. WHEN a lot state transition occurs, THE Platform SHALL record the user_id (or "SYSTEM" for auto-transitions such as REJECTED to QUARANTINED), action performed, entity_type, entity_id, transition details (from_status and to_status), and timestamp
3. WHEN an Admin accesses the audit log, THE Platform SHALL display entries sorted by timestamp descending (most recent first) with pagination of 25 entries per page and filtering by user, action type, entity type, and date range
4. THE Platform SHALL retain audit log entries indefinitely without automatic deletion
5. WHEN a user authenticates successfully or fails authentication, or when an Admin modifies system configuration or QC_Threshold values, THE Platform SHALL record the event in the audit log with the user_id, action type, and timestamp

### Requirement 11: QC Threshold Configuration

**User Story:** As an Admin, I want to configure quality thresholds per material type, so that pass/fail criteria can be adjusted as business needs evolve.

#### Acceptance Criteria

1. WHEN an Admin updates a QC_Threshold, THE Platform SHALL allow modification of min_confidence, pass_grade, and max_color_delta for each Material_Type independently
2. THE Platform SHALL validate that min_confidence is a decimal between 0.0 and 1.0 inclusive, pass_grade is one of A, B, C, D, or F, and max_color_delta is a positive decimal between 0.1 and 100.0 inclusive
3. IF a QC_Threshold update fails validation, THEN THE Platform SHALL reject the update and return a descriptive error message identifying the invalid field and the constraint violated
4. WHEN a QC_Threshold is updated, THE Platform SHALL record in the audit log the Admin who made the change, the timestamp, the Material_Type affected, and the previous and new values for each modified field
5. THE Platform SHALL apply updated thresholds only to inspections whose grading step (threshold comparison) occurs after the update timestamp, without retroactively changing the pass/fail outcome of previously graded inspections

### Requirement 12: Dashboard and Analytics

**User Story:** As a QC_Manager, I want a dashboard showing quality control metrics and trends, so that I can monitor overall quality performance and identify issues.

#### Acceptance Criteria

1. WHEN a QC_Manager accesses the dashboard, THE Platform SHALL display summary metrics for the trailing 30 days by default: total lots grouped by status, pass rate and fail rate as percentages, average AI confidence score across all completed inspections, and count of lots currently in MANAGER_REVIEW status
2. WHEN an Operator accesses the dashboard, THE Platform SHALL display the same metric categories as the QC_Manager view (total lots by status, pass/fail rates, average AI confidence score, and count pending review) scoped exclusively to lots where the Operator is recorded as created_by
3. WHEN an Admin accesses the dashboard, THE Platform SHALL display all metrics available to QC_Manager plus system health indicators including AI_Service availability status (reachable or unreachable based on the last health check) and inspection error rate as a percentage of inspections with status ERROR over the trailing 30 days
4. THE Platform SHALL refresh dashboard metrics within 30 seconds of a lot status change without requiring a manual page reload
5. WHEN a user accesses the dashboard, THE Platform SHALL provide a date range filter allowing the user to adjust the metrics period, with a minimum selectable range of 1 day and a maximum of 365 days

### Requirement 13: Notification System

**User Story:** As a platform user, I want to receive timely notifications about quality events relevant to my role, so that I can take appropriate action without constantly monitoring the system.

#### Acceptance Criteria

1. WHEN a lot transitions to QC_FAILED, THE Platform SHALL send an in-app notification and email to all active QC_Manager users within 60 seconds of the transition, including the Lot_Number, material_type, and the AI grade that triggered the failure
2. WHEN a lot is approved or rejected, THE Platform SHALL send an in-app notification to the Operator who created the lot within 60 seconds, including the Lot_Number, the decision (APPROVED or REJECTED), and the name of the QC_Manager who made the decision
3. WHEN a lot transitions to QUARANTINED, THE Platform SHALL send an in-app notification and email to all active Admin users within 60 seconds, including the Lot_Number and material_type
4. IF the AI_Service returns an error or fails 3 consecutive health checks, THEN THE Platform SHALL send an in-app notification and email to all active Admin users, throttled to at most one notification per 15-minute window per failure type to prevent notification flooding
5. WHEN a lot is auto-escalated to MANAGER_REVIEW due to exhausted retries, THE Platform SHALL send an in-app notification and email to all active QC_Manager users within 60 seconds, including the Lot_Number, the retry_count reached, and the escalation reason (AI_Service failure)
6. THE Platform SHALL send a daily summary email via DaaS_Cron to all active QC_Manager users containing the count of lots inspected, passed, failed, and pending review for that calendar day (00:00 to 23:59 server local time)
7. THE Platform SHALL maintain a read/unread status for each in-app notification per user, defaulting to unread upon delivery, and SHALL display the count of unread notifications in the application header
8. WHEN a user views an in-app notification, THE Platform SHALL mark it as read and SHALL provide a link or reference to navigate to the relevant lot detail

### Requirement 14: Daily Summary Cron Job

**User Story:** As a QC_Manager, I want to receive a daily email summary of quality control activity, so that I have a consolidated view of the day's results without checking the platform.

#### Acceptance Criteria

1. THE Platform SHALL implement the daily summary email as a DaaS Cron Job scheduled to run at 23:59 daily in the server's configured timezone
2. WHEN the daily summary cron job executes, THE Platform SHALL query all inspections created between 00:00:00 and 23:59:59 of the current day and calculate total_inspected, total_passed, total_failed, and total_pending_review counts
3. WHEN the daily summary cron job completes calculation, THE Platform SHALL send an email to all active QC_Manager users containing a subject line with the summary date, and a body listing total_inspected, total_passed, total_failed, and total_pending_review as labeled numeric values
4. IF no inspections were created during the current day, THEN THE Platform SHALL still send the daily summary email with all counts displayed as zero
5. IF the daily summary cron job encounters an error during execution, THEN THE Platform SHALL log the error details and send a failure notification via in-app notification and email to all active Admin users indicating the cron job name and the date for which the summary failed

### Requirement 15: Inspection Results and Reporting

**User Story:** As a QC_Manager, I want to view, filter, and export inspection results, so that I can analyze quality trends and generate compliance reports.

#### Acceptance Criteria

1. WHEN a user accesses the inspection results list, THE Platform SHALL display inspections in a paginated list with a default page size of 25 and options of 10, 25, 50, or 100 per page, with filtering by lot number, material type, grade, status, date range, and inspector
2. WHEN a user selects an inspection, THE Platform SHALL display the full inspection detail including the original image, annotated image from AI_Service, grade, confidence score, defects found, color analysis data, retry history, and review history
3. WHEN a QC_Manager requests a report export, THE Platform SHALL generate a downloadable CSV file containing the currently filtered inspection data including the fields: lot_number, material_type, material_name, inspection_date, inspector_name, grade, confidence_score, status, defects_found_count, and review_decision
4. IF a report export request would produce more than 10,000 records, THEN THE Platform SHALL inform the user that the export exceeds the maximum record limit and prompt them to apply additional filters to reduce the result set
5. THE Platform SHALL restrict Operators to viewing only inspections they created, while QC_Managers and Admins can view all inspections

### Requirement 16: User Management

**User Story:** As an Admin, I want to manage user accounts and role assignments, so that I can control who has access to the platform and what they can do.

#### Acceptance Criteria

1. WHEN an Admin creates a new user, THE Platform SHALL require email (valid email format, maximum 254 characters), name (between 1 and 100 characters), and role (OPERATOR, QC_MANAGER, or ADMIN)
2. WHEN an Admin updates a user, THE Platform SHALL allow modification of name (between 1 and 100 characters), role, and is_active status
3. WHEN an Admin deactivates a user, THE Platform SHALL prevent that user from logging in, terminate any active sessions belonging to that user within 30 seconds, and preserve their historical data and audit trail entries
4. THE Platform SHALL enforce unique email addresses (case-insensitive) across all user accounts
5. IF a user creation or update fails validation (invalid email format, name outside length bounds, duplicate email, or invalid role), THEN THE Platform SHALL return a descriptive error message identifying the invalid field and the constraint violated without applying any changes
6. IF an Admin attempts to deactivate their own account or change their own role to a non-ADMIN role, THEN THE Platform SHALL reject the operation and return an error indicating that self-demotion and self-deactivation are not permitted

### Requirement 17: Authentication and Session Management

**User Story:** As a platform user, I want secure authentication with session management, so that my account is protected and I remain logged in during my work shift.

#### Acceptance Criteria

1. THE Platform SHALL authenticate users via Supabase Auth through server-side proxy routes following the BuildPad authentication pattern
2. WHEN a user provides valid credentials, THE Platform SHALL create an authenticated session and redirect to the role-appropriate dashboard view: Operators to their lot overview, QC_Managers to the review queue dashboard, and Admins to the system dashboard
3. IF a user provides invalid credentials, THEN THE Platform SHALL display a generic error message without revealing whether the email or password was incorrect
4. WHEN a user session expires or the user logs out, THE Platform SHALL clear all session data including authentication tokens and redirect to the login page
5. IF a user with is_active set to false attempts to authenticate, THEN THE Platform SHALL reject the login and display the same generic error message used for invalid credentials
6. THE Platform SHALL enforce a session duration of 8 hours before requiring re-authentication
7. IF a user fails authentication 5 consecutive times within a 15-minute window, THEN THE Platform SHALL temporarily lock the account for 15 minutes and display a message indicating the account is temporarily locked
8. IF a user's is_active status is set to false while they have an active session, THEN THE Platform SHALL invalidate the session on the next request and redirect the user to the login page

### Requirement 18: HTTPS and Secure Deployment

**User Story:** As a system stakeholder, I want the platform deployed over HTTPS, so that camera access works in production and all data in transit is encrypted.

#### Acceptance Criteria

1. THE Platform SHALL be deployed with SSL/TLS certificates providing HTTPS access on all environments, enforcing a minimum of TLS 1.2
2. THE Platform SHALL require HTTPS for all WebRTC camera access (getUserMedia API) in production environments
3. IF a user accesses the platform over HTTP in production, THEN THE Platform SHALL respond with a permanent redirect (HTTP 301) to the equivalent HTTPS URL
4. THE Platform SHALL enforce HTTPS for all API communication between the Platform and the AI_Service, rejecting connections where the AI_Service presents an invalid, expired, or untrusted TLS certificate
5. IF the Platform cannot establish a secure TLS connection to the AI_Service, THEN THE Platform SHALL treat the request as an AI_Service error, record the TLS failure reason on the inspection record, and apply the standard retry mechanism defined in Requirement 5

### Requirement 19: System Configuration

**User Story:** As an Admin, I want to configure system-level settings including retry limits and AI service parameters, so that the platform behavior can be tuned without code changes.

#### Acceptance Criteria

1. WHEN an Admin accesses system configuration, THE Platform SHALL display the following configurable parameters: maximum inspection retry count (default 3, integer) and AI_Service response timeout in seconds (default 5, decimal)
2. WHEN an Admin updates the maximum retry count, THE Platform SHALL validate that the value is a positive integer between 1 and 10
3. WHEN an Admin updates the AI_Service response timeout, THE Platform SHALL validate that the value is a positive decimal between 1.0 and 30.0 seconds
4. IF an Admin submits a configuration value that fails validation, THEN THE Platform SHALL reject the update and return an error message identifying the parameter and the constraint violated
5. WHEN an Admin updates system configuration, THE Platform SHALL record the change in the audit log with the Admin identity, timestamp, parameter name, previous value, and new value
6. THE Platform SHALL apply updated configuration values to all subsequent operations without affecting inspections that have a status of PENDING or PROCESSING at the time of the change
