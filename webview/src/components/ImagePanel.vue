<template>
    <div>
      <h1>Hello</h1>
      <div v-for="(breakpoint, breakpointIdx) in breakpoints" :key="breakpointIdx">
        <h1>{{breakpoint.trackerId}}</h1>
        <div v-for="(thread, threadIdx) in breakpoint.threads" :key="threadIdx">
            <div v-for="(frame, frameIdx) in thread.frames" :key="frame.meta.name" style="display:grid;">
                <div v-for="(variable, variableIdx) in frame.variables" :key="variable.name"
                    class="variable-value grid-item"
                    style="
                      display: grid;
                      grid-column: {{ breakpointIdx+1 }} / {{ breakpointIdx+2 }};
                      grid-row: {{ frameIdx+variableIdx+1 }} / {{ frameIdx+variableIdx+2 }};
                      padding: 10px;
                      text-align: center;
                    "  >

                  <div v-if="variable.imagePath !== undefined">
                    <div class="variable">
                      <h3>{{ variable.name }}</h3>
                      <div hidden>{{frameIdx}}, {{ variableIdx }}</div>


                      <div>
                          <img :src="'https://file%2B.vscode-resource.vscode-cdn.net/'+encodeURI(variable.imagePath)" alt="image" style="width:100%">
                      </div>
                    </div>
                      
                      <!-- <div v-else class="variable-value">
                          <div class="grid-item">
                            <div>{{ variable.value }}</div>
                          </div>
                      </div> -->

                    </div>

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
    grid-template-rows: 100px 50px;
    grid-template-columns: 150px 1fr;
  }
  .grid-item {
    padding: 20px;
    text-align: center;
  }
  .desc {
    padding: 15px;
    text-align: center;
  }
  </style>
