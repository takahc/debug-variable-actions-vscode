#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"
#include <stdio.h>
#include <stdlib.h>
#include <math.h>

typedef struct {
    int width;
    int height;
    unsigned char *data;
} MyImage;



MyImage read_png_file_to_grayscale(const char *filename) {
    MyImage img;
    int n;
    unsigned char *data = stbi_load(filename, &img.width, &img.height, &n, 0);
    if (data == NULL) {
        fprintf(stderr, "Error loading MyImage %s\n", filename);
        exit(EXIT_FAILURE);
    }

    img.data = (unsigned char *)malloc(img.width * img.height);

    for (int y = 0; y < img.height; y++) {
        for (int x = 0; x < img.width; x++) {
            int index = y * img.width + x;
            int src_index = index * n;
            unsigned char r = data[src_index];
            unsigned char g = data[src_index + 1];
            unsigned char b = data[src_index + 2];
            unsigned char gray = (r + g + b) / 3;
            img.data[index] = gray;
        }
    }

    stbi_image_free(data);
    return img;
}


MyImage edge_detection(const MyImage *src) {
    MyImage dest;
    dest.width = src->width;
    dest.height = src->height;
    dest.data = (unsigned char *)malloc(dest.width * dest.height);

    int gx[3][3] = {
        {-1, 0, 1},
        {-2, 0, 2},
        {-1, 0, 1}
    };

    int gy[3][3] = {
        {-1, -2, -1},
        {0, 0, 0},
        {1, 2, 1}
    };

    for (int y = 1; y < src->height - 1; y++) {
        for (int x = 1; x < src->width - 1; x++) {
            int sumX = 0;
            int sumY = 0;

            for (int i = -1; i <= 1; i++) {
                for (int j = -1; j <= 1; j++) {
                    int index = (y + i) * src->width + (x + j);
                    unsigned char pixel = src->data[index];
                    sumX += pixel * gx[i + 1][j + 1];
                    sumY += pixel * gy[i + 1][j + 1];
                }
            }

            int magnitude = (int)sqrt(sumX * sumX + sumY * sumY);
            if (magnitude > 255) magnitude = 255;
            if (magnitude < 0) magnitude = 0;

            int index = y * src->width + x;
            dest.data[index] = (unsigned char)magnitude;
        }
    }

    return dest;
}


MyImage enhance_edges(const MyImage *gray, const MyImage *edges) {
    MyImage result;
    result.width = gray->width;
    result.height = gray->height;
    result.data = (unsigned char *)malloc(result.width * result.height);

    for (int y = 0; y < gray->height; y++) {
        for (int x = 0; x < gray->width; x++) {
            int index = y * gray->width + x;
            int enhanced = gray->data[index] + edges->data[index];
            if (enhanced > 255) enhanced = 255;
            result.data[index] = (unsigned char)enhanced;
        }
    }

    return result;
}


int main() {
    const char *filename = "example.png";
    MyImage img = read_png_file_to_grayscale(filename);

    MyImage edge = edge_detection(&img);
    MyImage enhanced = enhance_edges(&img, &edge);

    while(1){
        int a = 0;
    }

    free(img.data);
    free(edge.data);
    free(enhanced.data);
    
    return 0;
}