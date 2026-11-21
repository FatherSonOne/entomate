/**
 * Finding 19 regression tests: workflow nodes must never run user text as
 * JavaScript inside the server process.
 */
const BaseNode = require('../services/workflow/nodes/BaseNode');
const { CodeNode } = require('../services/workflow/nodes/ActionNodes');

describe('BaseNode.evaluateExpression', () => {
  const data = { item: { price: 5, status: 'open', count: 2, name: 'Ada' } };

  test.each([
    ['$item.price * 2', 10],
    ['($item.price + 1) / 2', 3],
    ['$item.price % 3', 2],
    ['-$item.price', -5],
    ['$item.status == "open" && $item.count > 1', true],
    ['$item.status != \'open\' || !$item.count', false],
    ['"Hi " + $item.name', 'Hi Ada'],
    ['$item.missing', undefined],
    ['true', true],
    ['null', null],
  ])('%s evaluates to %p', (expr, expected) => {
    expect(BaseNode.evaluateExpression(expr, data)).toEqual(expected);
  });

  test.each([
    'process.env',
    'process.mainModule.require("child_process")',
    'globalThis',
    'this.constructor',
    '$item.constructor.constructor("return process")()',
    '$item.__proto__',
    '[].constructor',
    '(() => 1)()',
    '1;2',
  ])('refuses to run %s and returns the text unchanged', (expr) => {
    expect(BaseNode.evaluateExpression(expr, data)).toBe(expr);
  });

  test('never exposes server environment variables', () => {
    process.env.__WORKFLOW_SECRET_PROBE = 'leak-me';
    const results = ['process.env.__WORKFLOW_SECRET_PROBE', '$process.env.__WORKFLOW_SECRET_PROBE']
      .map(e => BaseNode.evaluateExpression(e, data));
    expect(results).not.toContain('leak-me');
    delete process.env.__WORKFLOW_SECRET_PROBE;
  });
});

describe('nested path helpers block prototype pollution', () => {
  test('setNestedValue rejects __proto__ paths', () => {
    expect(() => BaseNode.setNestedValue({}, '__proto__.polluted', true)).toThrow();
    expect(() => BaseNode.setNestedValue({}, 'a.constructor.prototype.polluted', true)).toThrow();
    expect({}.polluted).toBeUndefined();
  });

  test('getNestedValue will not walk into constructor or __proto__', () => {
    expect(BaseNode.getNestedValue({ a: {} }, 'a.constructor')).toBeUndefined();
    expect(BaseNode.getNestedValue({ a: {} }, '__proto__')).toBeUndefined();
  });

  test('normal paths still work', () => {
    const obj = BaseNode.setNestedValue({}, 'a.b.c', 1);
    expect(BaseNode.getNestedValue(obj, 'a.b.c')).toBe(1);
    expect(BaseNode.getNestedValue({ x: 2 }, '$input.x')).toBe(2);
  });
});

describe('CodeNode', () => {
  test('refuses to execute any code', async () => {
    await expect(
      CodeNode.execute({ code: '$output = process.env' }, {}, { nodeId: 'n1' })
    ).rejects.toThrow(/disabled/i);
  });
});
