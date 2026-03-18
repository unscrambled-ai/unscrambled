import vm from "node:vm";

describe("vm", () => {
  test("load script and run in context", () => {
    const script = new vm.Script(`1 + 1`);
    const context = {};
    vm.createContext(context);

    expect(script.runInContext(context)).toEqual(2);
  });

  test("global saved from run to run", () => {
    const context = { test: 1 };
    vm.createContext(context);
    const script = new vm.Script(`test += 1`);
    script.runInContext(context);
    script.runInContext(context);
    script.runInContext(context);
    script.runInContext(context);

    expect(context.test).toEqual(5);
  });

  test("calling a synchronous module", () => {
    const script = new vm.Script(`
exports.handler = () => {
  return 'testing';
} 
`);
    const context = { exports: {} };
    vm.createContext(context);
    script.runInContext(context);

    expect(context.exports.handler()).toEqual("testing");
  });

  test("calling an async module", async () => {
    const script = new vm.Script(`
exports.handler = async () => {
  return new Promise((resolve) => {
    resolve('foo');
  })
} 
`);

    const context = { exports: {}, console: console };
    vm.createContext(context);
    script.runInContext(context);

    expect(await context.exports.handler()).toEqual("foo");
  });
});
