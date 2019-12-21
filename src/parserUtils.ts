
export function trimWhiteSpace(code: string, startPos: number, endPos: number) {
  const initStr = code.slice(startPos, endPos);
  const accStart = (initStr.match(/^\s+/) || [''])[0].length;
  const accEnd = (initStr.match(/\s+$/) || [''])[0].length;
  return {
    trimStart: startPos+accStart,
    trimEnd: endPos-accEnd
  };
}
