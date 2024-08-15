<template>
  <div class="grid-container">
    <div
      v-for="(image, index) in images"
      :key="index"
      :style="{ gridColumn: `${image.start} / span ${image.span}` }"
      class="grid-item"
    >
      <img :src="image.src" alt="Image" />
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      breakpoints: [1, 2, 3, 4, 5],
      images: [
        { src: "edge.png", span: 2, start: 1 }, // 1列目から始まり、2列にまたがる
        { src: "edge.png", span: 1, start: 3 }, // 3列目に表示
        { src: "edge.png", span: 3, start: 4 }  // 4列目から始まり、3列にまたがる
      ]
    };
  }
};
</script>