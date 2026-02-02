/**
 * WhatsApp Cloud API Character Limits
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */

export const WHATSAPP_LIMITS = {
  // Text Messages
  TEXT_MESSAGE: 4096,

  // Interactive Messages (Buttons)
  INTERACTIVE_HEADER: 60,
  INTERACTIVE_BODY: 1024,
  INTERACTIVE_FOOTER: 60,
  INTERACTIVE_BUTTON_TEXT: 20,
  INTERACTIVE_BUTTON_ID: 256,

  // CTA URL Button
  CTA_HEADER: 60,
  CTA_BODY: 1024,
  CTA_FOOTER: 60,
  CTA_BUTTON_TEXT: 20,
  CTA_URL: 2000,

  // List Messages
  LIST_HEADER: 60,
  LIST_BODY: 1024,
  LIST_FOOTER: 60,
  LIST_BUTTON_TEXT: 20,
  LIST_SECTION_TITLE: 24,
  LIST_ROW_TITLE: 24,
  LIST_ROW_DESCRIPTION: 72,

  // Template Messages
  TEMPLATE_HEADER: 60,
  TEMPLATE_BODY: 1024,
  TEMPLATE_FOOTER: 60,
  TEMPLATE_BUTTON_TEXT: 25,
  TEMPLATE_VARIABLE: 1024,

  // Media
  MEDIA_CAPTION: 1024,

  // Contact name
  CONTACT_NAME: 512,
} as const;

/**
 * Returns remaining characters for a field
 */
export function getRemainingChars(value: string, limit: number): number {
  return limit - (value?.length || 0);
}

/**
 * Checks if value exceeds limit
 */
export function isOverLimit(value: string, limit: number): boolean {
  return (value?.length || 0) > limit;
}

/**
 * Helper component props for character counter
 */
export function getCharCounterProps(value: string, limit: number) {
  const remaining = getRemainingChars(value, limit);
  const isOver = remaining < 0;
  const isWarning = remaining <= 10 && remaining >= 0;

  return {
    remaining,
    isOver,
    isWarning,
    text: `${value?.length || 0}/${limit}`,
    className: isOver ? 'text-destructive' : isWarning ? 'text-yellow-500' : 'text-muted-foreground',
  };
}
