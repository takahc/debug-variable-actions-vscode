<template>
  <div>
    <h1>Hello</h1>

    <!-- <div class="toolbar">
      <input type="checkbox" v-model="showOnlyImage" id="showOnlyImage" />
      <label for="showOnlyImage">Show only images</label>
    </div> -->

    <div style="display:flex;">

      <div v-for="(variables, breakIdx) in [{}, ...variableBreaks]" :key="breakIdx"
        :class="breakIdx === 0 ? `variables-head-left` : `variables-column`">
        <!-- <div v-for="(variables, breakIdx) in variableBreaks" :key="breakIdx"> -->

        <div class="variables-head-top">
          <span class="variables-head-top-text">
            {{ breakIdx === 0 ? `` : `Break ${variableBreaks.length - breakIdx + 1}` }}
          </span>
        </div>

        <div v-if="breakIdx === 0">
          <div v-for="variableKey in variableKeys" :key="variableKey" class="variable-item variable-head-left-item">
            <div class="variable-head-left-item">
              <div v-for="(value, key) of splitVkey(variableKey)" :key="key">
                <span :class="`variable-head-text-${key}`"
                  :style="{ color: key === 'varname' ? 'default' : `${stringToColor(value)}`, }">
                  {{ value }}
                </span>
              </div>
            </div>
            <!-- <VariableItem :variableKey="variableKey" /> -->
          </div>
        </div>
        <div v-else>
          <div v-for="variableKey in variableKeys" :key="variableKey" class="variable-item"
            :data-change-state="judgeChange(breakIdx - 1, variableKey)">
            <div v-if="variables[variableKey] !== undefined" class="variable-image">
              <div class="variable">
                <h3>{{ variables[variableKey].name }}</h3>
                <div>
                  <div v-if="variables[variableKey].imagePath !== undefined">
                    <img v-if="showHicontImage" :src="pathToUri(variables[variableKey].imageHiContPath)"
                      :alt="variables[variableKey].name" style="width: 100%;" />
                    <img v-else :src="pathToUri(variables[variableKey].imagePath)" :alt="variables[variableKey].name"
                      style="width: 100%;" />
                  </div>
                  <details v-else-if="variables[variableKey].isArray">
                    <summary>N/A</summary>
                    <!-- <prestyle="text-align:left; overflow:auto"><code>{{ JSON.stringify(variables[variableKey], null, 2) }}</code></pre> -->
                  </details>
                  <code v-else class="variable-value">{{ variables[variableKey].value }}</code>
                  <!-- <pre v-else style="text-align:left"><code>{{ JSON.stringify(variables[variableKey].value, null, 2) }}</code></pre> -->
                </div>
              </div>
            </div>
            <div v-else class="variable-vacant">
              <!-- <h3>{{ variables[variableKey].name }}</h3> -->
              <!-- <span>vacant</span> -->
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/* eslint-disable */
import vscode from '../vscodeApi';

export default {
  data() {
    return {
      variableBreaks: [],
      variableKeys: [],
      index: 0,
      showHicontImage: true,
      showOnlyImage: false,
      componentKey: 0
    }
  },
  methods: {
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
      let _module = "";
      if (vkey.split("!").length > 1) {
        _module = vkey.split("!")[0];
        fande = vkey.split("!")[1];
      }
      frame = fande.split("|")[0];
      varname = fande.split("|")[1];
      return { varname, frame, _module };
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
    stringToColor(str) {
      // Generate a hash from the string
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }

      // Convert the hash to RGB values
      const r = (hash >> 24) & 0xFF;
      const g = (hash >> 16) & 0xFF;
      const b = (hash >> 8) & 0xFF;

      // Convert RGB to hex color code
      const color = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
      return color;
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
                const funcNameMatch = frame.meta.name.match(/(?:[^!]*!)?(\w+)/);
                const funcName = funcNameMatch ? funcNameMatch[0] : '';
                const vkey = `${funcName}|${variable.expression}`;
                if (!this.variableKeys.includes(vkey)) {
                  this.variableKeys.push(vkey);
                }
                variables[vkey] = variable;
              }

            }
          }
        }
        this.variableBreaks = variableBreaks;
      },
      immediate: true
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

.variable-item[data-change-state="new"] {
  background-color: rgba(0, 255, 0, 0.1);
}

.variable-item[data-change-state="changed"] {
  background-color: rgba(255, 0, 0, 0.1);
}
</style>
