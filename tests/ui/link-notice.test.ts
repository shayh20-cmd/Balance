import { linkFailureNotice } from '../../src/ui/auth/linkNotice';

const text = 'קישור הכניסה לא הצליח כאן. בקשו קישור חדש והקלידו את הקוד מהמייל.';

test('a code that produced no session is a failed link', () => {
  expect(linkFailureNotice('?code=abc', false)).toBe(text);
});
test('a code that signed in is fine', () => {
  expect(linkFailureNotice('?code=abc', true)).toBeNull();
});
test('an auth error in the URL is a failed link', () => {
  expect(linkFailureNotice('?error=access_denied&error_description=Email+link+is+invalid', false)).toBe(text);
});
test('a plain launch shows nothing', () => {
  expect(linkFailureNotice('', false)).toBeNull();
});
