<template>
    <div>
        {{ text }}
    </div>
</template>

<script>

export default {
    data() {
        return {
            text: "Hello World",
            socket: null,
            formattedObject: null
        }
    },
    created() {
        this.setupWebSocket();
    },
    methods: {
        setupWebSocket() {
            this.socket = new WebSocket('ws://localhost:8081');
            this.socket.addEventListener('open', event => {
                console.log('WebSocket connected', event);
            });
            this.socket.addEventListener('message', event => {
                const message = JSON.parse(event.data);
                if (message.command === 'updateText') {
                    this.text = message.text;
                }
                this.formattedObject = message; // Store the object directly
            });
        }
    }
}
</script>

<style></style>