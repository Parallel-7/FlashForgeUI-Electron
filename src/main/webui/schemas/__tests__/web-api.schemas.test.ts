
import { JobStartRequestSchema } from '../web-api.schemas';

describe('JobStartRequestSchema', () => {
  it('should accept valid filenames', () => {
    const validInputs = [
      { filename: 'test.gcode' },
      { filename: 'folder/test.gcode' },
      { filename: 'my_print_job.gcode' },
      { filename: 'job.gcode', startNow: false },
    ];

    validInputs.forEach((input) => {
      const result = JobStartRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  it('should reject path traversal attempts', () => {
    const invalidInputs = [
      { filename: '../system.conf' },
      { filename: '../../etc/passwd' },
      { filename: 'folder/../hack.txt' },
      { filename: '/../root.txt' },
      { filename: '..\\windows\\system32' },
    ];

    invalidInputs.forEach((input) => {
      const result = JobStartRequestSchema.safeParse(input);
      // We expect validation to fail for these insecure inputs
      expect(result.success).toBe(false);
    });
  });
});
