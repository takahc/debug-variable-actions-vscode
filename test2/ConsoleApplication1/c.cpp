// ConsoleApplication1.cpp : このファイルには 'main' 関数が含まれています。プログラム実行の開始と終了がそこで行われます。
//

#include <iostream>
#include <ios>

typedef struct {
    int width;
    int height;
    unsigned char* data;
} Image;

typedef struct {
    int n;
    Image img[2];
} Images;


typedef struct {
    int head;
    int *data;
} S;


int sub(){
    char hoge = 'h';
    std::cout << "subdesu" << std::endl;
    return 0;
}

int main()
{
    int a;
    int *p = &a;

    S s;
    s.head = 20;
    s.data = &a;

    S ss[100];
    S ss2[10][4];
    S **ss3;
    ss3 = (S**)calloc(3, sizeof(S*));
    ss3[0] = (S*)calloc(2, sizeof(S));
    ss3[1] = (S*)calloc(2, sizeof(S));
    ss3[2] = (S*)calloc(2, sizeof(S));
    ss3[0] = ss;

    std::cout << "&(ss) = " << std::hex << &(ss) << std::endl;
    std::cout << "&(ss[0].head) = " << std::hex << &(ss[0].head) << std::endl;
    std::cout << "&(ss[0].data) = " << std::hex << &(ss[0].data) << std::endl;
    std::cout << "ss[0].data = " << std::hex << ss[0].data << std::endl;



    std::cout << "ss3 = " << std::hex << ss3 << std::endl;
    std::cout << "&(ss3) = " << std::hex << &(ss3) << std::endl;
    std::cout << "&(ss3[0][0]) = " << std::hex << &(ss3[0][0]) << std::endl;
    std::cout << "&(ss3[0][0].head) = " << std::hex << &(ss3[0][0].head) << std::endl;
    std::cout << "&(ss3[0][0].data) = " << std::hex << &(ss3[0][0].data) << std::endl;
    std::cout << "ss3[0][0].data = " << std::hex << ss3[0][0].data << std::endl;



    std::cout << "&(s) = " << std::hex << &(s) << std::endl;
    std::cout << "&(s.head) = " << std::hex << &(s.head) << std::endl;
    std::cout << "&(s.data) = " << std::hex << &(s.data) << std::endl;
    std::cout << "s.data = " << std::hex << s.data << std::endl;
    
    
    sub();
    

    unsigned char data[10 * 10];
    for (int i = 0; i < 10; i++) {
        for (int j = 0; j < 10; j++) {
            if (i % 2 == 0 && j % 2 == 0) {
                data[i * 10 + j] = 123;
            }
            else{
                data[i * 10 + j] = 0;
            }
        }
    }

    Image img;
    Image img2[2];

    img.width = 10;
    img.height = 10;   
    img.data = data;

    img2[0].width = 10;
    img2[0].height = 10;
    img2[1].width = 10;
    img2[1].height = 10;

    img2[0].data = data;
    img2[1].data = data;


    Images imgs;
    imgs.n = 2;
    imgs.img[0] = img2[0];
    imgs.img[1] = img2[1];
    
    int aasa = 1;
    
    
    // std::cout << "input:";
    // std::cin >> a;
    // std::cout << "show";
    // imshow("", image);
    // waitKey(0);
}
