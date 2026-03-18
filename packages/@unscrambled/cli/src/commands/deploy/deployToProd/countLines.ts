export default function countLines(str: string) {
  return (str.match(/\n/g) || "").length;
}
