<template>
  <div>
    <h1>Hello</h1>


    <div style="display:flex">

      <div class="variables-head-left">
        <div class="variables-head-top"><h2>a</h2></div>
        <div v-for="variableKey in variableKeys" :key="variableKey">
          <div class="variable-item">
            <h3>{{ variableKey }}</h3>
          </div>
        </div>
      </div>

      <div v-for="(variables, breakIdx) in variableBreaks" :key="breakIdx" :style="{gridColumn:  breakIdx+1 }">
        
        <div class="variables-head-top">
          <h2>Break {{ variableBreaks.length-breakIdx }}</h2>
        </div>

        <div v-for="variableKey in variableKeys" :key="variableKey" class="variables"
          :style="{
            width: `300px`,
            height: '200px',
            display: 'grid',
            gridColumn:  breakIdx+1,
            gridRow:  variableIdx+1,
            padding: '3px',
            textAlign: 'center',
            border: '1px solid gray',
          }">
          <div v-if="variables[variableKey] !== undefined" class="variable-item variable-image">
            <div class="variable">
              <h3>{{ variables[variableKey].name }}</h3>
              <div>
                  <img v-if="variables[variableKey].imagePath!==undefined" :src="'https://file%2B.vscode-resource.vscode-cdn.net/'+encodeURI(variables[variableKey].imagePath)" :alt="variableKey" style="width:100%">
                  <details v-else-if="variables[variableKey].isArray">
                    <summary>N/A</summary>
                    <pre style="text-align:left; overflow:auto"><code>{{ JSON.stringify(variables[variableKey], null, 2) }}</code></pre>
                  </details>
                  <code v-else class="variable-value">{{ variables[variableKey].value }}</code>
                  <!-- <pre v-else style="text-align:left"><code>{{ JSON.stringify(variables[variableKey].value, null, 2) }}</code></pre> -->
                </div>
              </div>
          </div>
          <div v-else class="variable-item variable-vacant">
              <!-- <h3>{{ variables[variableKey].name }}</h3> -->
                <!-- <span>vacant</span> -->
          </div>
        </div>
      </div>
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
    }
  },
  mounted() {
      // eslint-disable-next-line no-undef
      this.vscode = acquireVsCodeApi();

      // Handle the message inside the webview
      window.addEventListener('message', event => {
          let message = event.data; // The JSON data our extension sent
          if (!message) { message = event.message; }
          if (!message) { message = event; }
          console.log("message received", message);

          if(message.command === "images") {
              if(message.breakpoints.length !== 0) {
                this.breakpoints = message.breakpoints;
                // this.breakpoints = [message.breakpoints[message.breakpoints.length-1]];
                this.index++;
                console.log("breakpoints", this.breakpoints);

                const variableBreaks = [];
                for(const breakpoint of this.breakpoints) {
                const variables = {};
                variableBreaks.unshift(variables);
                  for(const thread of breakpoint.threads) {
                      for(const frame of thread.frames) {
                          for(const variable of frame.variables) {
                            const vkey = `${frame.meta.name}-${variable.name}`;
                            if(!this.variableKeys.includes(vkey)) {
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
  }
      
      
};
</script>

<style scoped>
img{
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

.variable-item{
  width: 300px;
  height: 200px;
}

.variable-vacant{
  border: 1px solid none;
}

.variable-head{
  width: 300px;
  height: 200px;
}

.variables-head-top{
  height: 3em;
  position: sticky;
  top:0;
  background-color: var(--vscode-editor-background);
  border: '1px solid gray';
  /* border-bottom: 2px solid; */
}
.variables-head-left{
  position: sticky;
  left: 0;
  background-color: var(--vscode-editor-background);
  
  border: '1px solid gray';
  /* border-right: 2px solid; */
}

.variable-value{
  font-size: 1.5em;
}

</style>
