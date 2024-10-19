<template>
    <el-upload class="upload-demo" drag action="#" multiple :on-change="onSuccess">
        <el-icon class="el-icon--upload">
            <UploadFilled />
        </el-icon>
        <div class="el-upload__text">
            Drop file here or <em>click to upload</em>
        </div>
        <template #tip>
            <div class="el-upload__tip">
                jpg/png files with a size less than 500kb
            </div>
        </template>
    </el-upload>
</template>

<script>
import { UploadFilled } from '@element-plus/icons-vue'

export default {
    components: {
        UploadFilled
    },
    methods: {
        handleRemove(file, fileList) {
            console.log(file, fileList);
        },
        handlePreview(file) {
            console.log(file);
        },
        onSuccess(response, uploadFile, uploadFiles) {
            console.log("onSuccess", response, uploadFile, uploadFiles);
            // this.$emit('file-uploaded', event.target.result);
        }
    }

};
</script>
