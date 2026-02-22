/**
 * Unit tests for VariableTypeFactory
 *
 * Tests type loading, primitive type retrieval, and custom image type configuration.
 */

import * as assert from 'assert';
import { VariableTypeFactory } from '../../variable/variableTypeFactory';
import { ImageVariableType } from '../../variable/imageVariable';
import { DebugVariableType } from '../../variable/debugVariable';

suite('VariableTypeFactory Unit Tests', () => {

    test('MyImageType returns correct default configuration', () => {
        const myImageType = VariableTypeFactory.MyImageType;

        assert.ok(myImageType instanceof ImageVariableType);
        assert.strictEqual(myImageType.name, 'Image');

        // Test by evaluating with sample data
        const binaryInfo = myImageType.evalBinaryInfo({ width: 10, height: 10 });
        assert.strictEqual(binaryInfo.sizeByte, 100); // 10*10*1*1
        assert.strictEqual(binaryInfo.littleEndian, true);
        assert.strictEqual(binaryInfo.signed, false);
        assert.strictEqual(binaryInfo.isInt, true);

        // Image info
        const imageInfo = myImageType.evalImageInfo({ width: 4, height: 4, data: '0x1234 ' });
        assert.strictEqual(imageInfo.mem_width, 4);
        assert.strictEqual(imageInfo.mem_height, 4);
        assert.strictEqual(imageInfo.channels, 1);
        assert.strictEqual(imageInfo.format, 'GRAY');
        assert.strictEqual(imageInfo.bytesForPx, 1);
    });

    test('get() retrieves primitive types correctly', () => {
        const charType = VariableTypeFactory.get('char');
        assert.ok(charType instanceof DebugVariableType);
        assert.strictEqual(charType?.name, 'char');

        const binaryInfo = charType?.evalBinaryInfo({});
        assert.strictEqual(binaryInfo?.sizeByte, 1);
        assert.strictEqual(binaryInfo?.signed, true);
        assert.strictEqual(binaryInfo?.isInt, true);

        const unsignedCharType = VariableTypeFactory.get('unsigned char');
        assert.ok(unsignedCharType instanceof DebugVariableType);
        const unsignedInfo = unsignedCharType?.evalBinaryInfo({});
        assert.strictEqual(unsignedInfo?.sizeByte, 1);
        assert.strictEqual(unsignedInfo?.signed, false);
    });

    test('get() retrieves int types with correct sizes', () => {
        const shortType = VariableTypeFactory.get('short');
        assert.strictEqual(shortType?.evalBinaryInfo({}).sizeByte, 2);

        const intType = VariableTypeFactory.get('int');
        assert.strictEqual(intType?.evalBinaryInfo({}).sizeByte, 4);

        const longLongType = VariableTypeFactory.get('long long');
        assert.strictEqual(longLongType?.evalBinaryInfo({}).sizeByte, 8);
    });

    test('get() retrieves float types with correct properties', () => {
        const floatType = VariableTypeFactory.get('float');
        const floatInfo = floatType?.evalBinaryInfo({});
        assert.strictEqual(floatInfo?.sizeByte, 4);
        assert.strictEqual(floatInfo?.signed, true);

        const doubleType = VariableTypeFactory.get('double');
        assert.strictEqual(doubleType?.evalBinaryInfo({}).sizeByte, 8);
    });

    test('get() returns undefined for unknown types', () => {
        const unknownType = VariableTypeFactory.get('UnknownType');
        assert.strictEqual(unknownType, undefined);
    });

    test('get() returns MyImageType for "Image" type', () => {
        const imageType = VariableTypeFactory.get('Image');
        assert.ok(imageType instanceof ImageVariableType);
        assert.strictEqual(imageType?.name, 'Image');
    });

    test('ImageTypeNames includes default Image type', () => {
        const typeNames = VariableTypeFactory.ImageTypeNames;
        assert.ok(Array.isArray(typeNames));
        assert.ok(typeNames.includes('Image'));
    });

    test('primitive types have correct signedness', () => {
        const signedTypes = ['char', 'short', 'int', 'long', 'long long'];
        const unsignedTypes = ['unsigned char', 'unsigned short', 'unsigned int', 'unsigned long', 'unsigned long long'];

        for (const typeName of signedTypes) {
            const type = VariableTypeFactory.get(typeName);
            const info = type?.evalBinaryInfo({});
            assert.strictEqual(info?.signed, true, `${typeName} should be signed`);
        }

        for (const typeName of unsignedTypes) {
            const type = VariableTypeFactory.get(typeName);
            const info = type?.evalBinaryInfo({});
            assert.strictEqual(info?.signed, false, `${typeName} should be unsigned`);
        }
    });

    test('MyImageType data pointer expression handles GDB format', () => {
        const myImageType = VariableTypeFactory.MyImageType;
        // Test that it extracts the hex address from "0x7f1234abcd <symbol>" format
        const imageInfo = myImageType.evalImageInfo({ data: '0x7f1234abcd <heap_memory>' });
        assert.strictEqual(imageInfo.data, '0x7f1234abcd');
    });
});
