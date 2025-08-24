export function strCase() {
  const result = "hello";
  return result;
}

export function objCase() {
  const result = {
    a: 1,
    b: "x",
  };
  return result;
}

export function objConstCase() {
  const result = {
    a: 1,
    b: "y",
    nested: { flag: true },
  } as const;
  return result;
}

