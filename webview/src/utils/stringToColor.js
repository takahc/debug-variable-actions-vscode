export function stringToColor(str) {
    // 数字とアルファベットだけを対象にする（記号やアンダースコアを無視する）
    const filteredStr = str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    // 0-9, a-z を 360 度に均等に割り当てる
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    const charToHue = {};
    const step = 360 / chars.length;

    // 各文字にHの値を割り当てる
    for (let i = 0; i < chars.length; i++) {
        charToHue[chars[i]] = i * step;
    }

    // HSL値を計算するための重み付け
    function calculateHue(str) {
        let hue = 0;
        const maxWeight = Math.min(str.length, 10);  // 最大10文字に重みをかける
        const baseWeight = 0.001;  // 2文字目以降の均等な重み
        for (let i = 0; i < maxWeight; i++) {
            const char = str[i].toLowerCase();
            if (charToHue[char] !== undefined) {
                const weight = (i === 0) ? 0.9 : baseWeight;  // 1文字目は重み0.9、以降は0.1ずつ
                hue += charToHue[char] * weight;
            }
        }

        // 文字数が異なる場合の補正: 文字数に基づき追加の補正を行う
        const lengthFactor = str.length % chars.length;  // 文字数に応じて補正を加える
        hue = (hue + lengthFactor * 10) % 360;  // 補正を追加して360度以内に収める

        return hue;
    }

    // S (彩度) と L (明度) を計算する
    function calculateSaturationAndLightness(str) {
        let sum = 0;
        for (let i = 0; i < str.length; i++) {
            sum += str.charCodeAt(i);
        }
        // S (彩度) は 50% - 80% の範囲
        const saturation = 50 + (sum % 30);
        // L (明度) は 40% - 70% の範囲
        const lightness = 40 + (sum % 30);
        return [saturation, lightness];
    }

    // HSLからRGBに変換する
    function hslToRgb(h, s, l) {
        s /= 100;
        l /= 100;
        const k = n => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = n =>
            l - a * Math.max(Math.min(k(n) - 3, 9 - k(n), 1), -1);
        return [
            Math.round(f(0) * 255),
            Math.round(f(8) * 255),
            Math.round(f(4) * 255),
        ];
    }

    // 最終的なカラーコードの生成
    const hue = calculateHue(filteredStr);
    let [saturation, lightness] = calculateSaturationAndLightness(filteredStr);
    saturation = 50; lightness = 50;
    const [r, g, b] = hslToRgb(hue, saturation, lightness);

    // RGBを16進数に変換
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}


// getTextColor関数で背景色に応じたテキスト色を設定
export function getTextColor(backgroundColor) {
    if (backgroundColor.startsWith('#')) {
        backgroundColor = backgroundColor.substring(1);
    }
    const r = parseInt(backgroundColor.substring(0, 2), 16);
    const g = parseInt(backgroundColor.substring(2, 4), 16);
    const b = parseInt(backgroundColor.substring(4, 6), 16);

    // 輝度を計算
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}