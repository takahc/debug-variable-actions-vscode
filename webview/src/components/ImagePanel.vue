<template>
  <div>
    <h1>Hello</h1>
    <!-- <button @click="reload">Reload</button> -->

    <div class="panel-view-root" v-if="breakpoints !== undefined">


      <div class="controller">
        <button @click="--index">&lt;</button>
        <button @click="++index">&gt;</button>
        <input type="range" v-model="index" :max="breakpoints.length - 1" />

        <input type="checkbox" id="showNonImageVariables" v-model="showNonImageVariables">
        <label for="showNonImageVariables">Show non-image variables</label>

      </div>

      <div v-if="breakpoints && breakpoints.length > 0" class="panel-view">
        <div v-for="(frame) in breakpoints[index].threads[0].frames" :key="frame.meta.name">
          <h2>{{ frame.meta.name }}</h2>
          <div class="variable-item" v-for="(variable) in frame.variables" :key="`${frame.meta.name}|${variable.name}`">
            <div class="variable">
              <h3>{{ variable.name }}</h3>
              <div>
                <img v-if="variable.imagePath !== undefined"
                  :src="'https://file%2B.vscode-resource.vscode-cdn.net/' + encodeURI(variable.imagePath)"
                  :alt="variable.name" style="width:100%">
                <details v-else-if="variable.isArray">
                  <summary>N/A</summary>
                  <pre style="text-align:left; overflow:auto"><code>{{ JSON.stringify(variable, null, 2) }}</code></pre>
                </details>
                <code v-else class="variable-value">{{ variable.value }}</code>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
    <div v-else>
      <h1>Waiting for data...</h1>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      breakpoints: [],
      variableBreaks: [],
      variableKeys: [],
      variableRenders: [],
      stacks: [],
      index: 0,
      vscode: undefined,
      showNonImageVariables: false
    }
  },
  methods: {
    reload() {
      // window.location.reload();
      // this.$router.go(0)
      this.$forceUpdate();
    }
  },
  created() {
    console.log("[vue] created", this, this.breakpoints)

    // eslint-disable-next-line no-undef
    this.vscode = acquireVsCodeApi();

    // Handle the message inside the webview
    window.addEventListener('message', event => {
      console.log("event received", event);
      let message = event.data; // The JSON data our extension sent
      if (!message) { message = event.message; }
      if (!message) { message = event; }
      console.log("message received", message);

      if (message.command === "images") {
        if (message.breakpoints.length !== 0) {
          this.breakpoints = message.breakpoints;
          // this.breakpoints = [message.breakpoints[message.breakpoints.length-1]];
          this.index = this.breakpoints.length - 1;
          console.log("breakpoints", this.breakpoints);

          const variableBreaks = [];
          for (const breakpoint of this.breakpoints) {
            const variables = {};
            variableBreaks.unshift(variables);
            for (const thread of breakpoint.threads) {
              for (const frame of thread.frames) {
                for (const variable of frame.variables) {
                  const vkey = `${frame.meta.name}-${variable.name}`;
                  if (!this.variableKeys.includes(vkey)) {
                    this.variableKeys.push(vkey);
                  }
                  variables[vkey] = variable;
                }
              }
            }
          }
          this.variableBreaks = variableBreaks;
          console.log("vue", this)
        }
      }
    });
  },


  beforeCreate() {
    console.log("[vue] beforeCreate", this, this.breakpoints)
  }
};
</script>

<style scoped>
img {
  max-width: 200px;
}
</style>


<style scoped>
.grid-container {
  display: grid;
  padding: 10px;
  /* grid-template-rows: 100px 50px; */
  /* grid-template-columns: 150px 1fr; */
}

.grid-item {
  padding: 20px;
  text-align: center;
}

.desc {
  padding: 15px;
  text-align: center;
}

.variable-item {
  width: 300px;
  height: 200px;
}

.variable-vacant {
  border: 1px solid none;
}

.variable-head {
  width: 300px;
  height: 200px;
}

.variables-head-top {
  height: 3em;
  position: sticky;
  top: 0;
  background-color: var(--vscode-editor-background);
  border: '1px solid gray';
  /* border-bottom: 2px solid; */
}

.variables-head-left {
  position: sticky;
  left: 0;
  background-color: var(--vscode-editor-background);

  border: '1px solid gray';
  /* border-right: 2px solid; */
}

.variable-value {
  font-size: 1.5em;
}

.panel-view {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1em;
}
</style>
