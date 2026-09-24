import {
  assertValidFiScope,
  formatFiIdForNxArgv,
  needsFiIdStringPrefix,
  normalizeFiScope,
  rewriteFiIdArgs,
} from './run-generate-mobile.mjs';

describe('normalizeFiScope', () => {
  it('preserves 5-digit ids with leading zeros', () => {
    expect(normalizeFiScope('03100')).toBe('03100');
    expect(normalizeFiScope('01234')).toBe('01234');
    expect(normalizeFiScope('12345')).toBe('12345');
  });

  it('zero-pads short numeric strings to 4 digits', () => {
    expect(normalizeFiScope('123')).toBe('0123');
    expect(normalizeFiScope('12')).toBe('0012');
  });

  it('handles numeric input without extra padding beyond length', () => {
    expect(normalizeFiScope(12345)).toBe('12345');
    expect(normalizeFiScope(123)).toBe('0123');
    expect(normalizeFiScope(3100)).toBe('3100');
  });

  it('strips str: prefix used to preserve leading zeros', () => {
    expect(normalizeFiScope('str:03100')).toBe('03100');
    expect(normalizeFiScope('str:01234')).toBe('01234');
  });
});

describe('assertValidFiScope', () => {
  it('accepts 4- and 5-digit ids', () => {
    expect(assertValidFiScope('0123')).toBe('0123');
    expect(assertValidFiScope('03100')).toBe('03100');
    expect(assertValidFiScope('12345')).toBe('12345');
    expect(assertValidFiScope('123')).toBe('0123');
  });

  it('rejects invalid ids', () => {
    expect(() => assertValidFiScope('abc')).toThrow(/digits only/);
    expect(() => assertValidFiScope('123456')).toThrow(/4 or 5 digits/);
    expect(() => assertValidFiScope('')).toThrow(/digits only/);
  });
});

describe('needsFiIdStringPrefix', () => {
  it('detects values that lose leading zeros when coerced', () => {
    expect(needsFiIdStringPrefix('03100')).toBe(true);
    expect(needsFiIdStringPrefix('01234')).toBe(true);
    expect(needsFiIdStringPrefix('0123')).toBe(false);
    expect(needsFiIdStringPrefix('12345')).toBe(false);
    expect(needsFiIdStringPrefix('123')).toBe(false);
  });
});

describe('formatFiIdForNxArgv', () => {
  it('adds str: prefix only when needed', () => {
    expect(formatFiIdForNxArgv('03100')).toBe('str:03100');
    expect(formatFiIdForNxArgv('0123')).toBe('0123');
    expect(formatFiIdForNxArgv('12345')).toBe('12345');
  });
});

describe('rewriteFiIdArgs', () => {
  it('re-emits fiId as separate argv preserving leading zeros', () => {
    expect(
      rewriteFiIdArgs([
        '--template=investment-portfolio',
        '--fiId=03100',
        '--name=smoke-test',
      ]),
    ).toEqual([
      '--template=investment-portfolio',
      '--fiId',
      'str:03100',
      '--name=smoke-test',
    ]);
    expect(rewriteFiIdArgs(['--fiId', '01234', '--name=smoke-test'])).toEqual([
      '--fiId',
      'str:01234',
      '--name=smoke-test',
    ]);
    expect(rewriteFiIdArgs(['--fiId=123', '--name=smoke-test'])).toEqual([
      '--fiId',
      '0123',
      '--name=smoke-test',
    ]);
    expect(rewriteFiIdArgs(['--fiId=12345', '--name=smoke-test'])).toEqual([
      '--fiId',
      '12345',
      '--name=smoke-test',
    ]);
  });
});
