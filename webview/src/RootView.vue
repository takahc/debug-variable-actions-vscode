<template>
  <p>Basic text button</p>
  <div class="mb-4">
    <el-button
      v-for="button in buttons"
      :key="button.text"
      :type="button.type"
      text
    >
      {{ button.text }}
    </el-button>
  </div>  </template>
  
  <script>
  export default {
    data() {
      return {
        buttons: [
          { text: 'Primary', type: 'primary' },
          { text: 'Success', type: 'success' },
          { text: 'Warning', type: 'warning' },
          { text: 'Danger', type: 'danger' },
          { text: 'Info', type: 'info' },
        ]
      }
    }
  }
  </script>