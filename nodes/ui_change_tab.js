module.exports = function(RED) {

    var ui = require('../ui')(RED);

    function ChangeTabNode(config) {
        RED.nodes.createNode(this, config);

        this.on('input', function(msg) {
            ui.emit('change-tab', {
                index: parseInt(msg.payload) || 0
            });
        });
    }

    RED.nodes.registerType("ui_change_tab", ChangeTabNode);
};
