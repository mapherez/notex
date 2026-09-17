let changing = false;

export function beginLibraryTransition(): () => void {
  if (changing) throw new Error('A library operation is already in progress');
  changing = true;
  return () => { changing = false; };
}
