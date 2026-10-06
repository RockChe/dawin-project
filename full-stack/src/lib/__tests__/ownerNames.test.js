import { describe, it, expect } from 'vitest';
import { replaceOwnerToken, replaceNameInList } from '@/lib/ownerNames';

describe('replaceOwnerToken', () => {
  it('sole owner', () => {
    expect(replaceOwnerToken('Amy', 'Amy', 'Amanda')).toBe('Amanda');
  });
  it('one of several: keeps order and original separators', () => {
    expect(replaceOwnerToken('Bob, Amy, Cat', 'Amy', 'Amanda')).toBe('Bob, Amanda, Cat');
    expect(replaceOwnerToken('Bob,Amy', 'Amy', 'Amanda')).toBe('Bob,Amanda');
  });
  it('similar prefix / substring names must not match', () => {
    expect(replaceOwnerToken('Amy Lin', 'Amy', 'X')).toBe('Amy Lin');
    expect(replaceOwnerToken('Amyy, Samy, Amy2', 'Amy', 'X')).toBe('Amyy, Samy, Amy2');
  });
  it('name appearing twice: every exact token replaced', () => {
    expect(replaceOwnerToken('Amy, Bob, Amy', 'Amy', 'Amanda')).toBe('Amanda, Bob, Amanda');
  });
  it('null / empty / no match returns input unchanged', () => {
    expect(replaceOwnerToken(null, 'Amy', 'X')).toBe(null);
    expect(replaceOwnerToken('', 'Amy', 'X')).toBe('');
    expect(replaceOwnerToken('Bob', 'Amy', 'X')).toBe('Bob');
  });
  it('replacement containing $ is literal', () => {
    expect(replaceOwnerToken('Amy', 'Amy', '$&$1')).toBe('$&$1');
  });
});

describe('replaceNameInList', () => {
  it('replaces exact entries only, keeps order', () => {
    expect(replaceNameInList(['Bob', 'Amy', 'Amy Lin'], 'Amy', 'Amanda')).toEqual(['Bob', 'Amanda', 'Amy Lin']);
  });
});
