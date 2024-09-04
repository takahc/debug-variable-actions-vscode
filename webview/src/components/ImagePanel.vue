<template>
  <div>
    <div class="panel-view-root" v-if="breakpoints !== undefined && breakpoints.length > 0">

      <div class="controller">
        <div class="instant-message" style="width: 100px;">{{ instantMessage }}</div>

        <button @click="index = Math.max(index - 1, 0); console.log('inddex', index)">&lt;</button>
        <button @click="index = Math.min(index + 1, breakpoints.length - 1); console.log('inddex', index)">&gt;</button>

        <div class="index-slider-container">
          <div class="index-slider-text-container" @click.stop="console.log('click', index); vscodeOpen(index)">
            <span class="index-breakpoint-text">Break {{ parseInt(index) + 1 }} of {{ breakpoints.length }}</span>
            <span class="index-source-text">{{ breakpoints[index].threads[0].meta.source.name }}</span>
            <span class="index-sournce-pos-text">:{{ breakpoints[index].threads[0].meta.line }},{{
              breakpoints[index].threads[0].meta.column }}</span>
          </div>
          <input class="index-slider" type="range" v-model="index" :max="breakpoints.length - 1"
            @input="console.log('input', index, breakpoints[index]); vscodeOpen(index)" />
        </div>

        <div class="image-size-slider-container">
          <div class="image-size-slider-text">Adjust Image Size: {{ imageSize }}</div>
          <input type="range" id="image-size-slider" v-model="imageSize" min="10" max="800" />
        </div>

        <div class="hicont-select-container">
          <input type="checkbox" id="show-hicont" v-model="showHicontImage" />
          <label for="show-hicont">High contrast</label>
        </div>

      </div>

      <div v-if="breakpoints && breakpoints.length > 0" class="panel-view">
        <div class="frame-stack" @click="expandStack = !expandStack">
          <div class="frame-stack-item" v-for="(frame, frameIdx) in breakpoints[index].threads[0].frames"
            :key="`framestack|${frame.meta.name.match(/.*[!].*?\(/gmi)[0]}`"
            :data-is-overflow-frame="frameIdx >= expandStackMin && !expandStack">
            <!-- <span v-if="frameIdx !== 0" class="frame-stack-sep">&gt;</span> -->
            <span class="frame-stack-name tooltip">
              <span class="tooltip-icon" v-if="breakpoints[index].threads[0].frames.length === 1"
                style="visibility:hidden;">─</span>
              <span class="tooltip-icon" v-else-if="frameIdx === 0">└</span>
              <span class="tooltip-icon"
                v-else-if="frameIdx === breakpoints[index].threads[0].frames.length - 1">─</span>
              <span class="tooltip-icon" v-else>├</span>
              <span class="frame-stack-name-text">
                <span class="tooltip-text">
                  <span v-if="frame.meta.source !== undefined">File: {{ frame.meta.source.name }}</span><br>
                  Line: {{ frame.meta.line }}, {{ frame.meta.column }}
                </span>
                <span>{{ frame.meta.name.match(/.*[!](.*)?\(/mi)[1] }}</span>
                <!-- <span>{{ frame.meta.name.match(/.*[!](.*)?\(.*(Line.*)/mi)[1] }}</span> -->
              </span>
            </span>
            <!-- <span v-if="frameIdx !== breakpoints[index].threads[0].frames.length - 1" -->
          </div>
          <div v-if="breakpoints[index].threads[0].frames.length > expandStackMin && !expandStack">
            <button class="expand-button" @click.stop="expandStack = !expandStack">
              &lpar;... Expand {{ breakpoints[index].threads[0].frames.length - expandStackMin }} frames&rpar;</button>
          </div>

        </div>

        <!-- image-variables -->
        <div v-for="(frame) in [breakpoints[index].threads[0].frames[0]]"
          :key="`imagevar|${frame.meta.name.match(/.*[!].*?\(/gmi)[0]}`">
          <div class="image-variables">
            <div class="image-variable-item"
              v-for="(variable) in frame.variables.filter(variable => variable.imagePath !== undefined)"
              :key="`${frame.meta.name.match(/.*[!].*?\(/gmi)[0]}|${variable.name}`"
              :data-change-state="breakpointDiffs[index][`${frame.meta.name.match(/.*[!].*?\(/gmi)[0]}|${variable.name}`]">
              <div>
                <img v-if="showHicontImage" :src="pathToUri(variable.imageHiContPath)" :alt="variable.name"
                  :style="{ width: imageSize + 'px' }" />
                <img v-else :src="pathToUri(variable.imagePath)" :alt="variable.name"
                  :style="{ width: imageSize + 'px' }" />
                <div class="image-variable-desc">
                  <div class="image-variable-name">
                    <a href="javascript:void(0)"
                      @click="copyImageToClipboard(pathToUri(showHicontImage ? variable.imageHiContPath : variable.imagePath))">
                      {{ variable.expression }}</a>
                  </div>
                  <div class="image-variable-desc-subs">
                    <div class="image-variable-type">{{ variable.meta.type }}</div>
                    <div class="image-variable-sizeinfo">
                      {{ variable.imageInfo.image_width }}x{{ variable.imageInfo.image_height }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- variable list -->
          <div class="variables-list" v-if="showVariableList">
            <div>
              <table>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Detail</th>
                </tr>
                <tr class="variable-list-item" v-for="(variable) in frame.variables"
                  :key="`${frame.meta.name.match(/.*[!].*?\(/gmi)[0]}|${variable.name}|list`"
                  :data-change-state="breakpointDiffs[index][`${frame.meta.name.match(/.*[!].*?\(/gmi)[0]}|${variable.name}`]"
                  :data-variable-category="variable.category">
                  <td class="variable-list-name">{{ variable.name }}</td>
                  <td class="variable-list-type">{{ variable.meta.type }}</td>
                  <td class="variable-list-value" v-if="variable.isArray">
                    <details>
                      <summary>{{ variable.meta.value }}</summary>
                      <pre
                        style="text-align:left; overflow:auto"><code>{{ JSON.stringify(variable.value, null, 2) }}</code></pre>
                    </details>
                  </td>
                  <td class="variable-list-value" v-else>
                    <div>{{ variable.value }}</div>
                  </td>
                  <td class="variable-list-detail">
                    <details>
                      <summary>Detail</summary>
                      <pre
                        style="text-align:left; overflow:auto"><code>{{ JSON.stringify(variable, null, 2) }}</code></pre>
                    </details>
                  </td>
                </tr>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else>
      <h1>Waiting for data...</h1>
    </div>

    <!-- <div class="debug" hidden="true">
      debug
      <details class="debug-breakpoints">
        <summary>breakpoints</summary>
        <pre><code>{{ JSON.stringify(breakpoints, null, 2) }}</code></pre>
      </details>
    </div> -->

  </div>
</template>

<script>
import vscode from '../vscodeApi';

export default {
  data() {
    return {
      variableBreaks: [],
      breakpointDiffs: [],
      variableKeys: [],
      index: 0,
      showNonImageVariables: false,
      imageSize: 200,
      expandStack: false,
      expandStackMin: 4,
      showHicontImage: true,
      instantMessage: "",
      showVariableList: false
    }
  },
  methods: {
    reload() {
      // window.location.reload();
      // this.$router.go(0)
      this.$forceUpdate();
    },
    async copyImageToClipboard(url) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const clipboardItem = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([clipboardItem]);
        console.log('Image copied to clipboard', url);
      } catch (error) {
        console.error('Failed to copy image to clipboard', url, error);
      }
    },
    pathToUri(p) {
      if (window.location.href.startsWith("vscode")) {
        return `https://file+.vscode-resource.vscode-cdn.net/${encodeURI(p)}`;
      } else {
        return `http://localhost:8082/files/${encodeURIComponent(p)}`;
      }
    },
    vscodeOpen(index) {
      // console.log("vscodeOpen", uri, pos, this);
      if (vscode) {
        index = parseInt(index);
        console.log("vscodeOpen", index, this.breakpoints, this.breakpoints[index]);
        const threadMeta = this.breakpoints[index].threads[0].meta;
        const uri = threadMeta.source.path;
        const pos = [threadMeta.line, threadMeta.column];
        vscode.postMessage({
          command: "open",
          text: "",
          uri, pos
        })
      }
    },
    updateInstantMessage(message, duration = 3000) {
      this.instantMessage = message;
      if (duration > 0) {
        setTimeout(() => {
          this.instantMessage = "";
        }, duration);
      }
    }
  },
  props: {
    breakpoints: {
      type: Array,
      required: true
    }
  },
  watch: {
    breakpoints: {
      handler(newBreakpoints) {
        // Create a list of variables for each breakpoint
        const variableBreaks = [];
        for (const breakpoint of newBreakpoints) {
          const variables = {};
          variableBreaks.push(variables);
          for (const thread of breakpoint.threads) {
            for (const frame of thread.frames) {
              for (const variable of frame.variables) {
                const vkey = `${frame.meta.name.match(/.*[!].*?\(/gmi)[0]}|${variable.name}`;
                if (!this.variableKeys.includes(vkey)) {
                  this.variableKeys.push(vkey);
                }
                variables[vkey] = variable;
              }
            }
          }
        }
        // this.variableBreaks = variableBreaks;
        console.log("variableBreaks", variableBreaks);
        this.variableBreaks = variableBreaks;


        // Create a list of changes
        const breakpointDiffs = [];
        newBreakpoints.forEach((breakpoint, breakpointIdx) => {
          const breakpointDiff = {};
          breakpointDiffs.push(breakpointDiff);
          for (const frame of breakpoint.threads[0].frames) {
            for (const variable of frame.variables) {
              const variableKey = `${frame.meta.name.match(/.*[!].*?\(/gmi)[0]}|${variable.name}`
              let changeState = "";
              if (breakpointIdx == 0)
                changeState = "new";
              else {
                if (breakpointDiffs[breakpointIdx - 1][variableKey] === undefined)
                  changeState = "new";
                else if (variable.category !== this.variableBreaks[breakpointIdx - 1][variableKey].category)
                  changeState = "changed";
                else if (variable.category === "image") {
                  if (this.variableBreaks[breakpointIdx - 1][variableKey].imageHash !== variable.imageHash)
                    changeState = "changed";
                  else
                    changeState = "same";
                } else {
                  if (variable.isArray)
                    changeState = "unknown";
                  else if (this.variableBreaks[breakpointIdx - 1][variableKey].value !== variable.value)
                    changeState = "changed";
                  else
                    changeState = "same";
                }
              }
              breakpointDiff[variableKey] = changeState;
            }
          }
        });
        console.log("breakpointDiffs", breakpointDiffs);
        this.breakpointDiffs = breakpointDiffs;

        this.index = newBreakpoints.length - 1;
      },
      immediate: true
    }
  },
  created() {
    console.log("[vue] created", this, this.breakpoints)

    // Handle the message inside the webview
    window.addEventListener('message', event => {
      console.log("event received", event);
      let message = event.data; // The JSON data our extension sent
      if (!message) { message = event.message; }
      if (!message) { message = event; }
      console.log("message received", message);

      if (message.command === "instant-message") {
        if (message.message === "WAITING FOR IMAGES...") {
          this.updateInstantMessage(message.message, -1);
        }
        else {
          this.updateInstantMessage(message.message);
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
/* Container */
.panel-view-root {
  padding: 20px;
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  font-family: Arial, sans-serif;
}

/* Headings */
h1 {
  font-size: 2em;
  color: var(--vscode-editor-foreground);
  margin-bottom: 1em;
}

/* Controller */
.controller {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  position: sticky;
  top: 0;
  background-color: var(--vscode-editor-background);
}

.controller button {
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  padding: 0.5em 1em;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.controller button:hover {
  background-color: var(--vscode-button-hoverBackground);
}

.controller input[type="range"] {
  flex-grow: 1;
}

.controller .index-slider-container {
  flex-grow: 1;
}

.controller .index-slider {
  width: 100%;
}


/* Grid for Images */
.image-variables {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  /* margin-bottom: 30px; */
  margin-bottom: 300px;
}


.image-variable-item {
  display: flex;
  align-items: flex-start;
  /* Align images to the top */
  justify-content: flex-start;
  /* Align images to the left */
  background-color: var(--vscode-editor-background);
  border: 1px solid var(--vscode-editorGroup-border);
  border-radius: 8px;
  padding: 10px;
  text-align: center;
  box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s, box-shadow 0.3s;
}


.image-variable-item[data-change-state="new"] {
  background-color: rgba(76, 175, 80, 0.3);
}

.image-variable-item[data-change-state="changed"] {
  background-color: rgba(255, 193, 7, 0.3);
}

d .variable-list-item[data-change-state="new"] {
  background-color: rgba(76, 175, 80, 0.3);
}

.variable-list-item[data-change-state="changed"] {
  background-color: rgba(255, 193, 7, 0.3);
}

.variable-item:hover {
  transform: translateY(-5px);
  box-shadow: 0px 8px 16px rgba(0, 0, 0, 0.2);
}

img {
  /* Set a fixed width */
  /* max-width: 300px; */
  object-fit: contain;

  /* Set a fixed height */
  /* height: 200px; */
  /* Ensure the image fits within the specified dimensions, cropping if necessary */
  /* border-radius: 5px; */
}

img.sizevary {
  max-width: 100%;
  max-height: 400px;
  /* Set a maximum height */
  width: auto;
  height: auto;
  object-fit: contain;
  /* Ensure the image maintains aspect ratio */
  border-radius: 5px;
}

/* Image Description */
.image-variable-desc {
  margin-top: 10px;
}

.image-variable-name a {
  font-weight: bold;
  color: var(--vscode-editor-foreground);
  text-decoration: none;
}

.image-variable-name a:hover {
  color: var(--vscode-textLink-activeForeground);
}

.image-variable-type {
  font-size: 0.85em;
  color: var(--vscode-descriptionForeground);
}

.image-variable-sizeinfo {
  font-size: 0.85em;
  color: var(--vscode-descriptionForeground);
}

.variables-list {
  position: fixed;
  bottom: 0;
  left: 0;
  background-color: var(--vscode-editor-background);
  height: 30%;
  overflow: auto;
  width: 100%;
  border-top: 1px solid var(--vscode-editor-foreground);
}

/* Variables Table */
.variables-list table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 30px;
}

.variables-list th,
.variables-list td {
  padding: 10px;
  text-align: left;
}

.variables-list th {
  background-color: var(--vscode-editor-background);
  border-bottom: 2px solid var(--vscode-editorGroup-border);
}

.variables-list td {
  border-bottom: 1px solid var(--vscode-editorGroup-border);
}

.variables-list tr:hover {
  /* background-color: var(--vscode-editor-hoverBackground); */
}

/* Collapsible Array Items */
details {
  cursor: pointer;
  margin-bottom: 5px;
}

details[open] summary {
  color: var(--vscode-textLink-activeForeground);
}

details summary {
  font-weight: bold;
}

details pre {
  background-color: var(--vscode-editor-background);
  padding: 10px;
  border-radius: 5px;
  box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.1);
}



/* Frame Stack Container */
.frame-stack {
  display: flex;
  flex-wrap: wrap;
  flex-direction: column-reverse;
  justify-content: flex-end;
  height: 10em;
  align-items: flex-start;
  padding: 10px 0;
  background-color: var(--vscode-editor-background);
  /* border-radius: 8px; */
  margin-bottom: 20px;
  border: 1px solid var(--vscode-editorGroup-border);
}

/* General Frame Stack Name Styling */
.frame-stack-item {
  font-size: 0.9em;
  color: var(--vscode-editor-foreground);
  /* margin-right: 10px; */
  position: relative;
  padding: 4px 4px 4px 2px;
  border-radius: 4px;
  /* background-color: var(--vscode-editor-background); */
  /* border: 1px solid var(--vscode-editorGroup-border); */
  /* transition: background-color 0.1s ease, color 0.1s ease, border-color 0.1s ease; */
}

.frame-stack-name:hover {
  background-color: var(--vscode-editor-hoverBackground);
  /* color: var(--vscode-editor-foreground); */
  border-color: var(--vscode-editor-hoverBackground);
}

/* Styling for the Last Frame (most important one) */
.frame-stack-item:first-child {
  /* background-color: var(--vscode-button-background); */

  font-weight: bold;
  /* font-size: 1em; */
  /* border: 2px solid var(--vscode-button-hoverBackground); */
}



/* Tooltip for Additional Info */
.tooltip {
  position: relative;
  display: inline-block;
  cursor: default;
  margin-left: 5px;
}

.tooltip .tooltip-text {
  visibility: hidden;
  max-width: 600px;
  background-color: var(--vscode-editor-background);
  border: 1px solid var(----vscode-editor-foreground);
  color: var(--vscode-editor-foreground);
  text-align: left;
  border-radius: 6px;
  padding: 10px;
  position: absolute;
  z-index: 1;
  top: 125%;
  /* Position below the element */
  left: 50%;
  /* margin-left: -110px; */
  margin-top: 5px;
  /* box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.1); */
  opacity: 0;
  transition: opacity 0.3s;
}

.tooltip:hover .tooltip-text {
  visibility: visible;
  opacity: 1;
}

/* Separator */
.frame-stack-sep {
  font-size: 1.2em;
  color: var(--vscode-editor-foreground);
  margin: 0 10px;
}

.frame-stack-name:last-child .frame-stack-sep {
  display: none;
}

.tooltip-icon {
  margin-right: 4px;
}

.frame-stack-item[data-is-overflow-frame$="true"]:nth-child(n+5) {
  display: none;
}


/* Expand button */
.expand-button {
  display: inline-block;
  padding: 5px 10px;
  font-size: 0.9em;
  font-weight: normal;
  color: var(--vscode-editorInactiveForeground);
  background-color: var(--vscode-editor-background);
  border: 1px solid var(--vscode-editorGroup-border);
  border-radius: 4px;
  cursor: pointer;
  text-decoration: underline;
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}

.expand-button:hover {
  background-color: var(--vscode-editor-hoverBackground);
  color: var(--vscode-editor-foreground);
  border-color: var(--vscode-editor-hoverBackground);
}

.expand-button:active {
  background-color: var(--vscode-editor-hoverBackground);
  color: var(--vscode-editor-foreground);
  border-color: var(--vscode-editor-foreground);
}

.expand-button:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--vscode-focusBorder);
}







/* Index slider */
.index-slider-text-container {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  width: 100%;
  /* padding: 10px; */
  background-color: var(--vscode-editor-background);
  /* border-radius: 5px; */
  /* box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); */
  /* font-family: 'Arial', sans-serif; */
  cursor: pointer;
}

.index-slider-text-container:hover {
  color: var(--vscode-textLink-activeForeground);
  background-color: var(--vscode-editor-hoverBackground);
}

.index-breakpoint-text {
  font-weight: bold;
  margin-right: 1em;
}

.index-source-text {
  color: var(--vscode-editorInactiveForeground);
}

.index-sournce-pos-text {
  font-weight: normal;
  color: var(--vscode-editorInactiveForeground);
}
</style>
