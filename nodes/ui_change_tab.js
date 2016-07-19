module.exports = function(RED) {

    var ui = require('../ui')(RED);

    function ChangeTabNode(config) {
        RED.nodes.createNode(this, config);

        this.on('input', function(msg) {
            ui.emit('change-tab', {
                target: msg.payload
            });
        });
    }

    RED.nodes.registerType("ui_change_tab", ChangeTabNode);
};
