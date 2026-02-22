import * as assert from 'assert';
import { EvalExpression } from '../../variable/evalExpression';

suite('EvalExpression', () => {

    test('basic arithmetic with context', () => {
        assert.strictEqual(
            EvalExpression.eval<number>('width * height', { width: 512, height: 512 }),
            262144
        );
    });

    test('sizeByte expression for MyImage (4×4 grayscale)', () => {
        assert.strictEqual(
            EvalExpression.eval<number>('width*height*1*1', { width: 4, height: 4 }),
            16
        );
    });

    test('data pointer extraction from GDB output (address + symbol)', () => {
        // GDB prints pointers as "0x7f1234abcd <symbol_name>"
        const result = EvalExpression.eval<string>(
            `String(((d)=> data.split(" ")[0] )(data))`,
            { data: '0x7f1234abcd <heap_memory>' }
        );
        assert.strictEqual(result, '0x7f1234abcd');
    });

    test('data pointer extraction when no symbol suffix', () => {
        const result = EvalExpression.eval<string>(
            `String(((d)=> data.split(" ")[0] )(data))`,
            { data: '0x7f1234abcd ' }
        );
        assert.strictEqual(result, '0x7f1234abcd');
    });

    test('garbage stack values produce out-of-range sizeByte', () => {
        // At line 111 in edge2_MyImage.c, 'edge' is declared but not yet assigned.
        // Stack garbage: width=-1073741824, height=32767
        const sizeByte = EvalExpression.eval<number>('width*height*1*1', {
            width: '-1073741824',
            height: '32767',
        });
        const MAX_READ_BYTES = 256 * 1024 * 1024;
        assert.ok(
            sizeByte <= 0 || sizeByte > MAX_READ_BYTES,
            `sizeByte=${sizeByte} should be out of safe range`
        );
    });

    test('zero dimensions produce zero sizeByte', () => {
        const sizeByte = EvalExpression.eval<number>('width*height*1*1', { width: '0', height: '0' });
        assert.strictEqual(sizeByte, 0);
    });

    test('evaluation without context', () => {
        assert.strictEqual(EvalExpression.eval<number>('2 + 2'), 4);
    });

    test('instance eval with multi-field expression', () => {
        const expr = new EvalExpression<number>('width * channels * bytesForPx');
        assert.strictEqual(expr.eval({ width: 640, channels: 3, bytesForPx: 1 }), 1920);
    });

    test('setExpression updates the expression', () => {
        const expr = new EvalExpression<number>('0');
        expr.setExpression('width + height');
        assert.strictEqual(expr.eval({ width: 100, height: 200 }), 300);
    });
});
