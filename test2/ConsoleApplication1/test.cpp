#include <iostream>

#define WIDTH 512
#define HEIGHT 512

typedef struct {
    int width;
    int height;
    unsigned char* data;
} Image;

typedef struct {
    int n;
    Image img[2];
} Images;

Image createRandomImage(int width, int height){
    unsigned char *data;
    data = (unsigned char*)malloc(sizeof(unsigned char) * width * height);
    bool bw_flag = false;
    for (int i = 0; i < height; i++) {
        for (int j = 0; j < width; j++) {
            if (i % 3 == 0 && j % 3 == 0){
                bw_flag = !bw_flag;
            }
            data[i * width + j] = bw_flag ? 255 : 0;
        }
    }
    Image img;
    img.width = width;
    img.height = height;
    img.data = data;
    return img;
}

void *clearImage(Image* img){
    for(int i = 0; i < (img->height)*(img->width); i++)
        img-> data[i] = 0;
}

void freeImage(Image* image){
    free(image->data);
}

int main()
{
    Image img = createRandomImage(512, 512);
    std::cout << "img.data = " << std::hex << img.data << std::endl;
    std::cout << "&(img.data) = " << std::hex << &(img.data) << std::endl;

    Image img2[2];
    img2[0] = createRandomImage(10, 10);
    img2[1] = createRandomImage(10, 20);

    // clear
    clearImage(&img);
    clearImage(&img2[0]);
    clearImage(&img2[1]);

    // free
    freeImage(&img);
    freeImage(&img2[0]);
    freeImage(&img2[1]);
}
