const XHTML = 'http://www.w3.org/1999/xhtml';

/** Creates an XHTML element in a (XUL) chrome document. */
export function el(doc: any, tag: string, props: { className?: string; text?: string | number } = {}, ...children: any[]): any {
  const e = doc.createElementNS(XHTML, tag);
  if (props.className) e.className = props.className;
  if (props.text !== undefined) e.textContent = String(props.text);
  e.append(...children);
  return e;
}
