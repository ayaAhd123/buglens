import Ajv from 'ajv';

const string = { type: 'string' };
export const detectiveSchema = {
  type: 'object', additionalProperties: false,
  required: ['summary', 'bugs', 'fixedCode'],
  properties: {
    summary: string, fixedCode: string,
    bugs: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['severity', 'explanation'],
      properties: {
        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info', 'unspecified'] },
        explanation: string, title: string, suggestedFix: string,
        line: { type: 'integer', minimum: 1 },
      },
    } },
  },
};
export const reviewerSchema = {
  type: 'object', additionalProperties: false,
  required: ['approved', 'feedback', 'concerns'],
  properties: {
    approved: { type: 'boolean' }, feedback: string,
    concerns: { type: 'array', items: string },
  },
};
const ajv = new Ajv();
export const validateDetective = ajv.compile(detectiveSchema);
export const validateReviewer = ajv.compile(reviewerSchema);
export const validateRequest = ajv.compile({
  type: 'object', additionalProperties: false, required: ['code', 'language'],
  properties: {
    code: { type: 'string', minLength: 1, maxLength: 50000, pattern: '\\S' },
    language: { type: 'string', enum: ['javascript', 'typescript'] },
  },
});
