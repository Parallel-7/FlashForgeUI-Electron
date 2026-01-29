
import { JobStartRequestSchema, ThemeProfileOperationSchema } from '../web-api.schemas';

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

describe('ThemeProfileOperationSchema', () => {
  const validColors = {
    primary: '#000000',
    secondary: '#ffffff',
    background: '#123456',
    surface: '#abcdef',
    text: '#987654',
  };

  it('should validate add operation', () => {
    const valid = {
      operation: 'add',
      data: {
        name: 'New Profile',
        colors: validColors,
      },
    };
    expect(ThemeProfileOperationSchema.safeParse(valid).success).toBe(true);
  });

  it('should validate update operation', () => {
    const valid = {
      operation: 'update',
      data: {
        originalName: 'Old Profile',
        updatedProfile: {
          name: 'New Profile',
          colors: validColors,
        },
      },
    };
    expect(ThemeProfileOperationSchema.safeParse(valid).success).toBe(true);
  });

  it('should validate delete operation', () => {
    const valid = {
      operation: 'delete',
      data: {
        name: 'Profile to Delete',
      },
    };
    expect(ThemeProfileOperationSchema.safeParse(valid).success).toBe(true);
  });

  it('should reject invalid operation', () => {
    const invalid = {
      operation: 'destroy',
      data: { name: 'test' },
    };
    expect(ThemeProfileOperationSchema.safeParse(invalid).success).toBe(false);
  });

  it('should reject invalid hex colors', () => {
    const invalid = {
      operation: 'add',
      data: {
        name: 'Bad Colors',
        colors: {
          ...validColors,
          primary: 'red', // Not a hex code
        },
      },
    };
    expect(ThemeProfileOperationSchema.safeParse(invalid).success).toBe(false);

    const invalid2 = {
      operation: 'add',
      data: {
        name: 'Bad Colors 2',
        colors: {
          ...validColors,
          primary: '#123', // Short hex not allowed by schema (requires 6 digits)
        },
      },
    };
    expect(ThemeProfileOperationSchema.safeParse(invalid2).success).toBe(false);
  });

  it('should reject missing fields', () => {
    const invalid = {
      operation: 'add',
      data: {
        name: 'Missing Colors',
        // colors missing
      },
    };
    expect(ThemeProfileOperationSchema.safeParse(invalid).success).toBe(false);
  });

  it('should reject overly long names', () => {
    const invalid = {
      operation: 'add',
      data: {
        name: 'a'.repeat(101),
        colors: validColors,
      },
    };
    expect(ThemeProfileOperationSchema.safeParse(invalid).success).toBe(false);
  });

  it('should reject names with invalid characters', () => {
    const invalidInputs = [
      'Profile<script>',
      'Profile/../',
      'Profile"',
      "Profile'",
      'Profile;',
      'Profile&',
    ];

    invalidInputs.forEach((name) => {
      const invalid = {
        operation: 'add',
        data: {
          name,
          colors: validColors,
        },
      };
      expect(ThemeProfileOperationSchema.safeParse(invalid).success).toBe(false);
    });
  });
});
