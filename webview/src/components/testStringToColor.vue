<template>
    <div id="app">
        <h1>String to Color Visualizer</h1>

        <!-- 大量のテスト文字列のリスト -->
        <ul>
            <li v-for="(testString, index) in testStrings" :key="index"
                :style="{ backgroundColor: stringToColor(testString), padding: '10px', margin: '5px 0', color: getTextColor(testString) }">
                {{ testString }} - {{ stringToColor(testString) }}
            </li>
        </ul>
    </div>
</template>

<script>
// stringToColor関数をutilsからインポート
import { getTextColor, stringToColor } from '@/utils/stringToColor';

export default {
    data() {
        return {
            testStrings: [
                // 短い前方一致
                'app', 'appl', 'apple', 'apple_', 'apple_pie', 'apple_cider', 'apple_tree', 'apple123', 'appleA', 'appleB',

                // 数字含む前方一致
                'test1', 'test12', 'test123', 'test1234', 'test12345', 'test123456', 'test_1', 'test_2', 'test_3', 'test_final',

                // アンダースコア含む前方一致
                'get_', 'get_data', 'get_info', 'get_user', 'get_user_data', 'get_user_info', 'get_details', 'get_detail_data', 'get_function', 'get_final',

                // 大文字と小文字の前方一致
                'abc', 'abcd', 'abcde', 'ABC', 'ABCD', 'ABCDE', 'Abc', 'AbCd', 'AbCdE', 'abc_final', 'ABC_FINAL',

                // 特定の文字列とその変種
                'init', 'init_', 'init_data', 'init_system', 'initialize', 'initialization', 'init_system1', 'init_system2', 'init_system_final',

                // 長い前方一致
                'super', 'superc', 'superca', 'supercal', 'supercall', 'supercali', 'supercalif', 'supercalifr', 'supercalifra', 'supercalifrag',
                'supercalifragili', 'supercalifragilis', 'supercalifragilist', 'supercalifragilistic', 'supercalifragilistice', 'supercalifragilisticex',

                // 数字が途中に含まれる前方一致
                'version1', 'version2', 'version10', 'version20', 'version100', 'version200', 'version1000', 'version_final', 'version_final_1', 'version_final_2',

                // 長い数字の前方一致
                'file001', 'file002', 'file003', 'file004', 'file005', 'file006', 'file007', 'file008', 'file009', 'file010',

                // 略語的な前方一致
                'config', 'configure', 'configuration', 'config_system', 'config_file', 'config_data', 'config_setting', 'config_user', 'config_user_data',

                // 短い文字列の前方一致
                'a', 'ab', 'abc', 'abcd', 'abcde', 'abcdef', 'abcdefg', 'abcdefgh', 'abcdefghi', 'abcdefghij',

                // 特定の関数に基づく前方一致
                'parse', 'parse_', 'parse_json', 'parse_xml', 'parse_data', 'parse_user', 'parse_user_data', 'parse_result', 'parse_file', 'parse_output',

                // 略語ベースの前方一致
                'UI', 'UX', 'UI_design', 'UX_design', 'UI_test', 'UX_test', 'UI_component', 'UX_flow', 'UI_dev', 'UX_dev',

                // 特定のドメインに基づく前方一致
                'cpu', 'cpu_temp', 'cpu_usage', 'cpu_performance', 'cpu_clock', 'cpu_power', 'cpu_load', 'cpu_utilization', 'cpu_speed', 'cpu_test',

                // ランダム前方一致のバリエーション
                'rand', 'rand_', 'rand1', 'rand2', 'rand3', 'rand_test', 'rand_value', 'rand_final', 'rand_case', 'rand_output',

                // 短い名前の前方一致
                'func', 'func1', 'func2', 'func_test', 'func_dev', 'func_final', 'func_output', 'func_data', 'func_case', 'func_input',

                // アンダースコア+数の前方一致
                'method_1', 'method_2', 'method_3', 'method_4', 'method_test', 'method_final', 'method_case', 'method_input', 'method_output', 'method_dev',


                // 既存のテストケース
                'apple', 'banana', 'cherry', 'date', 'eggfruit', 'fig', 'grape', 'honeydew', 'kiwi',
                'lemon', 'mango', 'nectarine', 'orange', 'papaya', 'quince', 'raspberry', 'strawberry',
                'tangerine', 'ugli', 'vanilla', 'watermelon', 'xigua', 'yellowfruit', 'zucchini',
                '123', 'abc', 'ABC', 'hello', 'world', 'Vue', 'JavaScript', 'TypeScript', 'test',
                'function', '123abc', 'ABC123', 'vuejs', 'background', 'color', 'visualization',
                'example', 'similarity', 'contrast', 'dark', 'light',

                // C/C++ 関数名っぽいもの
                'initialize', 'initialize_system', 'getData', 'processData', 'shutdown_system',
                'parse_json', 'load_config', 'save_to_file', 'close_connection', 'isEmpty',

                // アンダースコア含むもの、長めの関数名
                'compute_result', 'generate_output', 'perform_calculation', 'convert_to_string', 'release_memory',
                'load_from_database', 'update_user_profile', 'set_configuration', 'get_user_input', 'clear_buffer',

                // 略語や一般的な短い名前
                'UI', 'UX', 'CPU', 'GPU', 'API', 'CLI', 'XML', 'HTML', 'JSON', 'YAML',

                // さらに長い単語
                'supercalifragilisticexpialidocious', 'pneumonoultramicroscopicsilicovolcanoconiosis',
                'antidisestablishmentarianism', 'floccinaucinihilipilification', 'hippopotomonstrosesquipedaliophobia',

                // 数字混じりの文字列
                'function_123', 'data_456', 'result_789', 'input_001', 'output_002', 'version_1_0_0',

                // 特定の構文に基づいたもの
                'for_loop', 'while_loop', 'do_while', 'if_statement', 'switch_case', 'try_catch',
                'throw_exception', 'lambda_expression', 'closure_function', 'anonymous_function',

                // ランダムな文字列
                'randomString123', 'abcdefg987', 'xyz_123_456', 'test_test_001', 'test_case_999',
                'abcd_efgh_ijkl', 'ijkl_mnop_qrst', 'functionX1', 'variableY2', 'temp123'
            ].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
        };
    },
    methods: {
        stringToColor(str) {
            return stringToColor(str);
        },
        getTextColor(str) {
            return getTextColor(str);
        }

    }
};
</script>

<style scoped>
#app {
    font-family: Avenir, Helvetica, Arial, sans-serif;
    text-align: center;
    color: #2c3e50;
    margin-top: 60px;
}

ul {
    list-style-type: none;
    padding: 0;
}

li {
    font-size: 18px;
    border-radius: 5px;
    display: inline-block;
    width: 200px;
    text-align: center;
}
</style>