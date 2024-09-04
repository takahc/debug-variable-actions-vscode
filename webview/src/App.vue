<template>
  <select v-model="selectedComponent">
    <option value="ImageStack">ImageStack</option>
    <option value="ImagePanel">ImagePanel</option>
    <option value="ImageTable">ImageTable</option>
    <option value="testElementPlusTableSubTree">testElementPlusTableSubTree</option>
    <option value="ImageVirtualTable">ImageVirtualTable</option>
  </select>
  <!-- <JsonUploader /> -->
  <JsonSelector />
  <component :is="selectedComponent" :key="selectedComponent" :breakpoints="breakpoints"></component>
</template>

<script>
import ImageStack from './components/ImageStack.vue'
import ImagePanel from './components/ImagePanel.vue'
import ImageTable from './components/ImageTable.vue'
import JsonUploader from './components/JsonUploader.vue';
import JsonSelector from './components/JsonSelector.vue';
import testStringToColor from './components/testStringToColor.vue';
import testElementPlusTableSubTree from './components/testElementPlusTableSubTree.vue';
import ImageVirtualTable from './components/ImageVirtualTable.vue';

export default {
  name: 'App',
  components: {
    ImageStack,
    ImagePanel,
    JsonUploader,
    JsonSelector,
    ImageTable,
    testStringToColor,
    testElementPlusTableSubTree,
    ImageVirtualTable,
  },
  data() {
    return {
      selectedComponent: 'ImageStack',
      breakpoints: []
    }
  },
  created() {
    this.setupMessageHandler();
    this.setupWebSocket();
  },
  methods: {
    messageHanlder(message) {
      console.log("message received", message);
      if (message.command === "images") {
        if (message.breakpoints.length !== 0) {
          this.breakpoints = message.breakpoints;
          // this.breakpoints = [message.breakpoints[message.breakpoints.length-1]];
          console.log("breakpoints", this.breakpoints);
        }
      }
    },
    setupMessageHandler() {
      // Handle the message inside the webview
      window.addEventListener('message', event => {
        console.log("event received", event);
        let message = event.data; // The JSON data our extension sent
        if (!message) { message = event.message; }
        if (!message) { message = event; }
        this.messageHanlder(message);
      });
    },
    setupWebSocket() {
      this.socket = new WebSocket('ws://localhost:8081');
      this.socket.addEventListener('open', event => {
        console.log('WebSocket connected', event);
      });
      this.socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        this.messageHanlder(message);
      });
    }
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  /* text-align: center; */
  /* color: #2c3e50; */
  /* margin-top: 60px; */
}
</style>
