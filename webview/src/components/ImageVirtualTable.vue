<template>
    <div>
        <h1>Virtual Table</h1>
        <el-table-v2 v-model:expanded-row-keys="expandedRowKeys" :columns="columns" :data="breakpointsTreeData"
            :width="700" :expand-column-key="expandColumnKey" :height="400" fixed @row-expand="onRowExpanded"
            @expanded-rows-change="onExpandedRowsChange" />
    </div>
</template>

<script>
import { ref } from 'vue';
import { TableV2FixedDir } from 'element-plus';
// import { getTextColor, stringToColor } from '../utils/stringToColor';

export default {
    name: 'ImageVirtualTable',
    props: {
        breakpoints: {
            type: Array,
            required: true
        }
    },
    watch: {
        breakpoints: {
            deep: true,
            handler: function (newBreakpoints) {
                console.log('breakpoints changed', newBreakpoints);
                const breakpointsTreeData = [];

            },
        }
    },
    data() {
        return {
            columns: this.generateColumns(10).map((column, columnIndex) => {
                let fixed;
                if (columnIndex < 2) fixed = TableV2FixedDir.LEFT;
                if (columnIndex > 8) fixed = TableV2FixedDir.RIGHT;
                return { ...column, fixed };
            }),
            data: this.generateData(this.generateColumns(10), 200),
            expandColumnKey: 'column-0',
            expandedRowKeys: ref([]),
            variableKeys: [],
        };
    },
    computed: {
        treeData() {
            return this.unflatten(this.breakpoints);
        },
        breakpointsTreeData() {
            console.log('breakpointsTreeData:', this.unflatten(this.breakpoints));
            return this.unflatten(this.breakpoints);
        }
    },
    methods: {
        traverse(variable, result = [], id = 0){ 
            if(variable.isArray){
                result.push(
                    {
                        id: id,
                        parentId: null,
                        [this.expandColumnKey]: variable[0]
                    }
                );

                for(let i = 0; i < variable.length; i++){
                    this.traverse(variable[i], result);
                }
            }else{

            }
        },
        generateColumns(length = 10, prefix = 'column-', props) {
            return Array.from({ length }).map((_, columnIndex) => ({
                ...props,
                key: `${prefix}${columnIndex}`,
                dataKey: `${prefix}${columnIndex}`,
                title: `Column ${columnIndex}`,
                width: 150,
            }));
        },
        generateData(columns, length = 200, prefix = 'row-') {
            return Array.from({ length }).map((_, rowIndex) => {
                return columns.reduce(
                    (rowData, column, columnIndex) => {
                        rowData[column.dataKey] = `Row ${rowIndex} - Col ${columnIndex}`;
                        return rowData;
                    },
                    {
                        id: `${prefix}${rowIndex}`,
                        parentId: null,
                    }
                );
            });
        },
        unflatten(data, rootId = null, dataKey = 'id', parentKey = 'parentId') {
            const tree = [];
            const childrenMap = {};

            for (const datum of data) {
                const item = { ...datum };
                const id = item[dataKey];
                const parentId = item[parentKey];

                if (Array.isArray(item.children)) {
                    childrenMap[id] = item.children.concat(childrenMap[id] || []);
                } else if (!childrenMap[id]) {
                    childrenMap[id] = [];
                }
                item.children = childrenMap[id];

                if (parentId !== undefined && parentId !== rootId) {
                    if (!childrenMap[parentId]) childrenMap[parentId] = [];
                    childrenMap[parentId].push(item);
                } else {
                    tree.push(item);
                }
            }

            return tree;
        },
        onRowExpanded({ expanded }) {
            console.log('Expanded:', expanded);
        },
        onExpandedRowsChange(expandedKeys) {
            console.log(expandedKeys);
        }
    },
    created() {
        // Add some sub items
        for (let i = 0; i < 50; i++) {
            this.data.push(
                {
                    ...this.data[0],
                    id: `${this.data[0].id}-sub-${i}`,
                    parentId: this.data[0].id,
                    [this.expandColumnKey]: `Sub ${i}`,
                },
                {
                    ...this.data[2],
                    id: `${this.data[2].id}-sub-${i}`,
                    parentId: this.data[2].id,
                    [this.expandColumnKey]: `Sub ${i}`,
                },
                {
                    ...this.data[2],
                    id: `${this.data[2].id}-sub-sub-${i}`,
                    parentId: `${this.data[2].id}-sub-${i}`,
                    [this.expandColumnKey]: `Sub-Sub ${i}`,
                }
            );
        }
    }
};
</script>