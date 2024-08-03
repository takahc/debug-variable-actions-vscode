# debug-variable-actions README

A VSCode extension for debugging variables

## Features

### Automatically show images

When a breakpoint is reached during debugging, a panel is automatically opened on the right. This panel shows the variables as images.

![feature X](https://i.imgur.com/LjON7en.gif)

## Requirements

-   Enable this extension in settings

## Extension Settings

This extension contributes the following settings:

-   `debug-variable-actions.config.enable`: Enable/disable this extension.
-   `debug-variable-actions.config.image-types`: Configure original image types

### Image types

Example for `MyImage`

```c
typedef struct {
    int width;
    int height;
    unsigned char *data;
} MyImage;
```

Add below to settings.json.

```json
...
    "debug-variable-actions.config.image-types": [
        {
            "display_name": "MyImage",
            "match_types": ["MyImage", "MyImage *"],
            "binary_info": {
                "sizeByte": "width*height*1*1",
                "littleEndian": "true",
                "signed": "false",
                "fixedSize": "false",
                "isInt": "true"
            },
            "image_info": {
                "mem_width": "width",
                "mem_height": "height",
                "image_width": "width",
                "image_height": "height",
                "stride": "width*1",
                "channels": "1",
                "data": "String(((d)=> data.split(' ')[0] )(data))",
                "format": "'GRAY'",
                "bytesForPx": "1"
            }
        }
    ]
...
```

## Known Issues

-   Tested only for 1-channel images
-   Tested only for C/C++ debugger

## Release Notes

### 0.\*

release test
