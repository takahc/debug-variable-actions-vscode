<template>
  <div>
    <h1>Table</h1>

    <!-- <div class="toolbar">
      <input type="checkbox" v-model="showOnlyImage" id="showOnlyImage" />
      <label for="showOnlyImage">Show only images</label>
    </div> -->

    <div style="display:flex;">


      <table style="border-spacing: 0;">
        <tr class="sticky-top">
          <th class="sticky-top-left"></th>
          <th v-for="(breakpoint, breakIdx) in breakpoints" :key="breakIdx">
            Break {{ breakpoints.length - breakIdx }}
          </th>
        </tr>
        <tr class="sticky-top">
          <th class="sticky-top-left"></th>
          <td v-for="(breakpoint, breakIdx) in breakpoints" :key="breakIdx" style="text-align: center;padding:0 3.5px;">
            <el-link v-if="breakpoint.threads[0].frames[0].meta.source !== undefined">
              {{ breakpoint.threads[0].frames[0].meta.source.name.split(/[\\/]/g).pop() }}:{{
                splitFrameName(breakpoint.threads[0].frames[0].meta.name)['line'] }}
            </el-link>
          </td>
        </tr>

        <tr v-for="frameIdx in frameRange" :key="frameIdx">

          <!-- <td class="sticky-top-left"></td> -->
          <td></td>


          <td v-for="(frames, breakIdx) in frameBreaks" :key="breakIdx" :style="{
            backgroundColor: frames[frameIdx] === undefined ? 'default' : stringToColor(splitFrameName(frames[frameIdx].meta.name)['frame']),
            borderColor: frames[frameIdx] === undefined ? 'default' : stringToColor(splitFrameName(frames[frameIdx].meta.name)['frame']),
            borderWidth: '1px',
          }">

            <!-- -->
            <div v-if="frames[frameIdx] !== undefined"
              :style="{ color: getTextColor(stringToColor(splitFrameName(frames[frameIdx].meta.name)['frame'])) }">

              <!-- frame -->
              <span v-if="breakIdx == 0 || frameBreaks[breakIdx - 1][frameIdx] === undefined" class="sticky-left-frame">
                {{ splitFrameName(frames[frameIdx].meta.name)['frame'] }}
              </span>
              <span class="sticky-left-frame"
                v-else-if="splitFrameName(frameBreaks[breakIdx - 1][frameIdx].meta.name)['frame'] !== splitFrameName(frames[frameIdx].meta.name)['frame']">
                {{ splitFrameName(frames[frameIdx].meta.name)['frame'] }}
              </span>

              <!-- line -->
              <!-- <span style="color:gray">&nbsp;{{ splitFrameName(frames[frameIdx].meta.name)['line'] }}</span> -->

              <!-- module -->
              <!-- <span style="color:gray">&nbsp;({{ splitFrameName(frames[frameIdx].meta.name)['module'] }})</span> -->

              <!-- filename and line -->
              <!-- <span v-if="frames[frameIdx].meta.source !== undefined" style="opacity: 0.5;">
                &nbsp;{{ frames[frameIdx].meta.source.name.split(/[\\/]/g).pop() }}:{{
                  splitFrameName(frames[frameIdx].meta.name)['line'] }}
              </span> -->

            </div>
          </td>
        </tr>


        <tr v-for=" (variableKey) in Object.keys(variablesStore)" :key="variableKey">
          <td class="sticky-left">{{ splitVkey(variableKey)['varname'] }}</td>
          <td v-for="(variable, breakIdx) in variablesStore[variableKey]" :key="breakIdx"
            :data-change-state="judgeChange(breakIdx, variableKey)">
            <div v-if="variable.variable !== undefined" class="variable-image">
              <div class="variable">
                <!-- <h3>{{ variable.variable.name }}</h3> -->
                <div>
                  <div v-if="variable.variable.imagePath !== undefined">
                    <img v-if="showHicontImage" :src="pathToUri(variable.variable.imageHiContPath)"
                      :alt="variable.variable.name" style="width: 100%;" />
                    <img v-else :src="pathToUri(variable.variable.imagePath)" :alt="variable.variable.name"
                      style="width: 100%;" />
                  </div>
                  <div v-else-if="variable.variable.isArray">
                    []
                    <!-- <summary>-</summary> -->
                    <!-- <prestyle="text-align:left; overflow:auto"><code>{{ JSON.stringify(variable.variable, null, 2) }}</code></pre> -->
                  </div>
                  <code v-else>{{ variable.variable.value }}</code>
                  <!-- <pre v-else style="text-align:left"><code>{{ JSON.stringify(variable.variable.value, null, 2) }}</code></pre> -->
                </div>
              </div>
            </div>
            <div v-else class="variable-vacant">
              <!-- <h3>{{ variable.variable.name }}</h3> -->
              <!-- <span>vacant</span> -->
            </div>
          </td>
        </tr>
      </table>


    </div>
  </div>
</template>

<script>
/* eslint-disable */
import vscode from '../vscodeApi';
import { getTextColor, stringToColor } from '../utils/stringToColor';

export default {
  data() {
    return {
      variableBreaks: [],
      variableKeys: [],
      variablesStore: {},
      frameBreaks: [],
      frameNumMax: 0,
      index: 0,
      showHicontImage: true,
      showOnlyImage: false,
      componentKey: 0
    }
  },
  computed: {
    frameRange() {
      return Array.from({ length: this.frameNumMax }, (_, i) => i);
    }
  },
  methods: {
    stringToColor(str) {
      return stringToColor(str);
    },
    getTextColor(color) {
      return getTextColor(color);
    },
    judgeChange(breakIdx, variableKey) {
      const newVariable = this.variableBreaks[breakIdx][variableKey];
      if (breakIdx === this.variableBreaks.length - 1) {
        if (newVariable !== undefined) {
          return "new";
        } else {
          return "same";
        }
      }
      const oldVariable = this.variableBreaks[breakIdx + 1][variableKey];
      if ((oldVariable === undefined && newVariable !== undefined)) {
        return "new";
      }
      else if ((oldVariable !== undefined && newVariable === undefined)) {
        return "changed";
      }
      else if (oldVariable == undefined && newVariable === undefined) {
        return "same";
      }
      else if (oldVariable.imagePath !== undefined && newVariable.imagePath !== undefined) {
        if (oldVariable.imageHash !== newVariable.imageHash) {
          return "changed";
        } else {
          return "same";
        }
      }
      else if (oldVariable.isArray || newVariable.isArray) {
        return "same";
      }
      else if (oldVariable.value !== newVariable.value) {
        return "changed";
      }
      return "same";
    },
    reRenderComponent() {
      this.componentKey += 1;
    },
    pathToUri(p) {
      if (window.location.href.startsWith("vscode")) {
        return `https://file+.vscode-resource.vscode-cdn.net/${encodeURI(p)}`;
      } else {
        return `http://localhost:8082/files/${encodeURIComponent(p)}`;
      }
    },
    splitVkey(vkey) {
      let module, frame, varname;
      let fande = vkey;
      if (vkey.split("|").length > 1) {
        module = vkey.split("!")[0];
        fande = vkey.split("!")[1];
      }
      frame = fande.split("|")[0];
      varname = fande.split("|")[1];
      return { varname, frame, module };
    },
    splitFrameName(frameName) {
      let module, frame, args, line = undefined;
      const sp = frameName.match(/^(?:(.*)[!])?(.*)?\((.*)\)(?:\s*Line\s*([0-9]*))?$/mi)
      module = sp[1];
      frame = sp[2];
      args = sp[3];
      line = sp[4];
      return { module, frame, args, line };
    },
    gatherImageVariables(variables, imageVariables) {
      // Recursively gather all image variables
      for (const variable of variables) {
        if (variable.imagePath) {
          imageVariables.push(variable);
        }
        if (variable.value) {
          this.gatherImageVariables(variable.value, imageVariables);
        }
      }
      return imageVariables;
    },
  },
  props: {
    breakpoints: {
      type: Array,
      required: true
    }
  },
  watch: {
    breakpoints: {
      immediate: true,
      handler(newBreakpoints) {
        // newBreakpoints = [message.breakpoints[message.breakpoints.length-1]];
        this.index++;
        console.log("breakpoints", newBreakpoints);

        const variableBreaks = [];
        for (const breakpoint of newBreakpoints) {
          const variables = {};
          variableBreaks.unshift(variables);
          for (const thread of breakpoint.threads) {
            for (const frame of thread.frames) {
              const gatheredVariables = frame.variables;
              console.log("vue variables bef", gatheredVariables);
              gatheredVariables.push(...this.gatherImageVariables(gatheredVariables, []));
              console.log("vue gatheredVariables", gatheredVariables);
              for (const variable of gatheredVariables) {
                const vkey = `${frame.meta.name.match(/.*[!].*?\(/gmi)[0]}|${variable.expression}`;
                if (!this.variableKeys.includes(vkey)) {
                  this.variableKeys.push(vkey);
                }
                variables[vkey] = variable;
              }

            }
          }
        }
        this.variableBreaks = variableBreaks;

        const variablesStore = {};
        for (const variableKey of this.variableKeys) {
          const { varname, frame, module } = this.splitVkey(variableKey);
          const variableValues = this.variableBreaks.map((variableBreak, breakIdx) => {
            const variable = variableBreak[variableKey];
            const changeState = this.judgeChange(breakIdx, variableKey);
            return {
              variable,
              changeState,
              breakIdx,
              color: stringToColor(varname),
              varname,
              frame,
              module
            };
          });
          variablesStore[variableKey] = variableValues;
        }
        this.variablesStore = variablesStore;
        console.log("variablesStore", variablesStore)

        // frameBreaks
        const frameBreaks = [];
        let frameNumMax = 0;
        for (const breakpoint of newBreakpoints) {
          const thread = breakpoint.threads[0];
          frameNumMax = frameNumMax < thread.frames.length ? thread.frames.length : frameNumMax;
          frameBreaks.unshift([...thread.frames].reverse());
        }
        this.frameBreaks = frameBreaks;
        this.frameNumMax = frameNumMax;
      }
    }
  },
  mounted() {

    // Handle the message inside the webview
    window.addEventListener('message', event => {
      let message = event.data; // The JSON data our extension sent
      if (!message) { message = event.message; }
      if (!message) { message = event; }
      console.log("message received", message);

    });
  }


};
</script>

<style scoped>
:root {
  --sticky-top-height: 20px;
}

img {
  max-width: 200px;
  max-height: 150px;
  object-fit: contain;
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
  display: grid;
  padding: 3px;
  text-align: center;
  text-wrap: wrap;
  border: 1px solid gray;
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

  /* border-right: 2px solid; */
}

.variable-value {
  font-size: 1.5em;
}


.variable-head-text-varname {
  font-size: 1.5em;
  font-weight: bold;

}

.variables-head-top {
  height: 50px;
  display: flex;
  justify-content: flex-start;
  align-items: self-end;
  padding: 5px;
}

.variables-head-top-text {
  font-size: 1.5em;
  font-weight: bold;
}

.variable-head-left-item {
  border: 1px solid rgba(0, 0, 0, 0);
  text-align: left;
}

td[data-change-state="new"] {
  border: 1px solid rgba(0, 255, 0, 0.9);
  background-color: rgba(0, 255, 0, 0.1);
}

td[data-change-state="changed"] {
  border: 1px solid rgba(255, 0, 0, 0.9);
  background-color: rgba(255, 0, 0, 0.1);
}

td {
  margin: 0px;
  padding: 0px;
  min-width: 210px;
}


.sticky-top-left {
  position: sticky;
  top: 0;
  left: 0;
  background-color: var(--vscode-editor-background);
  z-index: 200;
}

.sticky-top {
  position: sticky;
  top: 0;
  background-color: var(--vscode-editor-background);
  z-index: 100;
  height: 20px
}

.sticky-top+.sticky-top {
  top: 20px;
  /* Adjust this value based on the height of the first sticky row */
}

.sticky-left {
  position: sticky;
  left: 0;
  background-color: var(--vscode-editor-background);
  z-index: 1;
}

.sticky-left-frame {
  position: sticky;
  left: 0;
  z-index: 150;
}
</style>
