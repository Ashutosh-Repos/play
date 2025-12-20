import sanitizeHtml from "sanitize-html";

export const sanitizeConfig: sanitizeHtml.IOptions = {
  allowedTags: [], // No HTML tags allowed
  allowedAttributes: {},
  disallowedTagsMode: 'recursiveEscape' as const,
};

export const sanitize = (content: string): string => {
  return sanitizeHtml(content, sanitizeConfig).trim();
};
