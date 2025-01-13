<template>
    <div>
        <el-row>
            <el-col :span="1">
                <el-button @click="fetchFiles" :loading="loading" type="primary" style="width: 100%;">
                    <el-icon>
                        <Refresh />
                    </el-icon>
                </el-button>
            </el-col>


            <el-col :span="22">

                <el-row v-if="files.length">
                    <el-col :span="24">
                        <el-select v-model="selectedFile" placeholder="Select a file" @change="fetchFileDetails"
                            style="width: 100%;" popper-class="popper">
                            <el-option v-for="file in sortedFiles" :key="file.path" :label="formatFileLabel(file)"
                                :value="file.path"></el-option>
                        </el-select>
                    </el-col>
                </el-row>
                <Transition>
                    <el-row v-show="fileLoading" class="overlay">
                        <el-col :span="24">
                            <el-alert title="Loading data..." type="info" show-icon></el-alert>
                        </el-col>
                    </el-row>
                </Transition>

                <Transition>
                    <el-row v-show="loading" class="overlay">
                        <el-col>
                            <el-alert title="Fetching data..." type="info" show-icon></el-alert>
                        </el-col>
                    </el-row>
                </Transition>
            </el-col>

            <el-col :span="1">
                <el-button @click="fetchFileDetails" :loading="loading" type="primary" style="width: 100%;">
                    <el-icon>
                        <Upload />
                    </el-icon>
                </el-button>
            </el-col>


        </el-row>



    </div>
</template>


<script>
import { ElButton, ElSelect, ElOption, ElAlert, ElRow, ElCol } from 'element-plus';
import { Refresh, Upload } from '@element-plus/icons-vue'
// import 'element-plus/lib/theme-chalk/index.css';

export default {
    components: {
        ElButton,
        ElSelect,
        ElOption,
        ElAlert,
        ElRow,
        ElCol,
        Refresh,
        Upload,
    },
    data() {
        return {
            files: [],
            selectedFile: '',
            fileDetails: null,
            loading: false,
            fileLoading: false,
        };
    },
    computed: {
        sortedFiles() {
            return [...this.files].sort((a, b) => new Date(b.stats.mtime) - new Date(a.stats.mtime));
        }
    },
    mounted() {
        this.fetchFiles();
    },
    methods: {
        async fetchFiles() {
            this.loading = true;
            try {
                const response = await fetch('http://localhost:8082/breakpoints');
                const data = await response.json();
                this.files = data.files;
            } catch (error) {
                console.error('Error fetching files:', error);
            } finally {
                this.loading = false;
            }
        },
        async fetchFileDetails() {
            this.fileLoading = true;
            try {
                const response = await fetch(`http://localhost:8082/files/${encodeURIComponent(this.selectedFile)}`);
                const breakpoints = await response.json();
                console.log("breakpoints", String(breakpoints).substr(0, 100));
                this.emitBreakpoints(breakpoints);
            } catch (error) {
                console.error('Error fetching file details:', error);
            } finally {
                this.fileLoading = false;
            }
        },
        formatFileLabel(file) {
            const date = new Date(file.stats.mtime).toLocaleString();
            return `${file.path} (Modified: ${date})`;
        },
        emitBreakpoints(breakpoints) {
            window.postMessage({
                command: "images",
                breakpoints
            });
        }
    }
};
</script>


<style>
:root {
    --el-fill-color-blank: var(--vscode-editor-background);
}

.popper {
    color: var(--vscode-editor-foreground);
    background-color: var(--vscode-editor-background);
}

.el-select-dropdown__item.is-selected {
    color: var(--vscode-list-active-selection-foreground);
    background-color: var(--vscode-list-active-selection-background);
}

.el-select-dropdown__item.is-selected.is-hovering {
    color: var(--vscode-list-active-selection-foreground);
    background-color: var(--vscode-list-active-selection-background);
}

.el-select-dropdown__item.is-hovering {
    color: var(--vscode-list-hover-foreground);
    background-color: var(--vscode-list-hover-background);
}


h1 {
    font-size: 24px;
    margin-bottom: 20px;
}

.el-button {
    margin-bottom: 20px;
}

.el-alert {
    margin-bottom: 20px;
}

pre {
    background: #f4f4f4;
    padding: 10px;
    border: 1px solid #ddd;
}

.overlay {
    position: absolute;
    top: 25px;
    left: 0;
    width: 100%;
    z-index: 10;
    background: rgba(230, 230, 230);
    /* Optional: to make the overlay semi-transparent */
}

.v-enter-active,
.v-leave-active {
    transition: all 0.3s ease-in-out;
}

.v-enter-from,
.v-leave-to {
    opacity: 0;
}
</style>