/**
 * Timeout configurations for various API calls and UI operations (in milliseconds)
 * Centralized timeout configuration for the application
 * All timeout values are in milliseconds
 */

/**
 * Timeout for streaming LLM responses (resources and action plans)
 * 600,000ms = 10 minutes
 *
 * Reasoning: Streaming operations involve long-running LLM inference that can take
 * several minutes, especially for complex queries or when generating comprehensive
 * resource lists. The 10-minute timeout provides sufficient buffer for:
 * - LLM inference time (varies by query complexity)
 * - Network latency and streaming overhead
 * - Backend processing (RAG retrieval, validation, etc.)
 */
export const STREAMING_TIMEOUT = 600_000;

/**
 * Timeout for legacy non-streaming action plan generation
 * 120,000ms = 2 minutes
 *
 * Reasoning: The non-streaming action plan endpoint is a legacy fallback that
 * returns the complete response at once. This is faster than streaming but still
 * requires LLM inference time. The 2-minute timeout is sufficient because:
 * - Action plans are typically shorter than full resource lists
 * - Non-streaming has less overhead than SSE
 * - Used as a fallback when streaming is not available
 *
 * Note: This differs from STREAMING_TIMEOUT (10 min) for the streaming version.
 * Consider standardizing to STREAMING_TIMEOUT if this endpoint is still used.
 */
export const ACTION_PLAN_TIMEOUT = 120_000;

/**
 * Timeout for FCC API location lookups by coordinates
 * 5,000ms = 5 seconds
 *
 * Reasoning: The FCC API (geo.fcc.gov) is a fast, public government API that
 * typically responds in under 1 second. The 5-second timeout provides:
 * - Sufficient buffer for network latency
 * - Quick failure for unavailable API (better UX than long wait)
 * - Allows the app to continue with degraded functionality if lookup fails
 */
export const LOCATION_FETCH_TIMEOUT = 5_000;

/**
 * Timeout for email delivery operations
 * 300,000ms = 5 minutes
 *
 * Reasoning: Email operations involve multiple backend steps:
 * - Retrieving result data from database
 * - Formatting HTML email template
 * - Sending through email service (SMTP/API)
 * - Awaiting delivery confirmation
 * The 5-minute timeout balances user experience with reliability.
 */
export const EMAIL_TIMEOUT = 300_000;

/**
 * UI timeout to show "No resources found" if no data arrives
 * 12,000ms = 12 seconds
 *
 * Reasoning: Provides user feedback if the streaming response is delayed or empty:
 * - Prevents indefinite loading state
 * - 12 seconds is long enough for initial API response but short enough to
 *   maintain good UX (users expect feedback within 10-15 seconds)
 * - Clears automatically once first resource arrives
 */
export const NO_RESOURCES_TIMEOUT = 12_000;

/**
 * Auto-dismiss timeout for the undo notification after removing a resource
 * 7,500ms = 7.5 seconds
 *
 * Reasoning: Temporary notification that allows users to undo a removal:
 * - 7.5 seconds is sufficient time for users to notice and act
 * - Not too long to clutter the UI
 * - Follows common UX patterns for undo notifications (5-10 seconds)
 */
export const UNDO_NOTIFICATION_TIMEOUT = 7_500;
