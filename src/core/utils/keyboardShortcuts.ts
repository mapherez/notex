type ShortcutKeyboardEvent = {
  altKey: boolean;
  code: string;
  ctrlKey: boolean;
  isComposing?: boolean;
  key: string;
  metaKey: boolean;
  repeat?: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
};

const letterPattern = /^\p{L}$/u;

export function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  const editableElement = target.closest(
    'input, textarea, select, [contenteditable="true"], [role="textbox"]',
  );

  if (!editableElement) {
    return false;
  }

  if (editableElement instanceof HTMLInputElement) {
    return editableElement.type !== 'button' && editableElement.type !== 'checkbox' && editableElement.type !== 'radio';
  }

  return true;
}

export function isPlainLetterShortcut(event: ShortcutKeyboardEvent) {
  return (
    !event.repeat &&
    !event.isComposing &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    letterPattern.test(event.key)
  );
}

export function isPrimaryShortcut(event: ShortcutKeyboardEvent, key: string) {
  return (
    !event.repeat &&
    !event.altKey &&
    !event.shiftKey &&
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === key.toLowerCase()
  );
}

export function getPrimaryDigitShortcutIndex(event: ShortcutKeyboardEvent, max: number) {
  if (event.repeat || event.altKey || event.shiftKey || (!event.ctrlKey && !event.metaKey)) {
    return null;
  }

  return getDigitShortcutIndex(event, max);
}

export function getShiftDigitShortcutIndex(event: ShortcutKeyboardEvent, max: number) {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || !event.shiftKey) {
    return null;
  }

  return getDigitShortcutIndex(event, max);
}

export function focusTextControlAtEnd(element: HTMLInputElement | HTMLTextAreaElement | null) {
  if (!element) {
    return;
  }

  element.focus();
  const cursorPosition = element.value.length;
  element.setSelectionRange(cursorPosition, cursorPosition);
}

function getDigitShortcutIndex(event: ShortcutKeyboardEvent, max: number) {
  const match = event.code.match(/^Digit([1-9])$/);
  if (!match) {
    return null;
  }

  const index = Number(match[1]) - 1;
  return index >= 0 && index < max ? index : null;
}
