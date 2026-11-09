export function capitalizeCropWords(value: string) {
  return value.replace(/(^|[\s-])(\p{L})/gu, (_match, separator: string, letter: string) =>
    separator + letter.toLocaleUpperCase(),
  );
}
