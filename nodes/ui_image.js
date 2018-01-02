module.exports = function (RED) {
    var ui = require('../ui')(RED);
    var formidable = require('formidable');
    var fs = require('fs');
    var path = require('path');
    var mkdirp = require('mkdirp');
    var FileInterface = require('../src/images/FileInterface');

    function ImageNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        var currentImage = null;

        var hei = Number(config.height || 0);

        var image;
        var defines;

        var fileInterface = new FileInterface();

        var pathDir = path.join(process.cwd(), "public", "uiimage", "upload");

        ///------> API

        RED.httpAdmin.post('/uiimage', (req, res) => {

            var form = new formidable.IncomingForm();

            form.parse(req, function (err, fields, files) {

                var params = {
                    category: fields['category'],
                    name: files[0].name,
                    path: files[0].path
                };

                fileInterface.saveFile(params, (err, result) => {
                    if (err) {
                        res.status(err.cod).send(err).end();
                        return;
                    }
                    res.status(result.cod).send(result.object).end();
                });

            });
        }); //--> POST /uiimage

        RED.httpAdmin.get("/uiimage", (req, res) => {
            fileInterface.getFiles((err, result) => {
                if (err) {
                    res.status(err.cod).send(err).end();
                    return;
                }
                res.status(result.cod).send(result).end();
            });
        }); //--> GET /uiimage

        RED.httpAdmin.get("/uiimage/:category/:id", (req, res) => {

            let params = {
                id: req.params.id,
                category: req.params.category
            };

            fileInterface.getFile(params, (err, result) => {
                if (err) {
                    res.status(err.cod).send(err).end();
                    return;
                }
                res.status(result.cod).send(result.object).end();
            });
        }); //--> GET /uiimage/'category'/'id'

        RED.httpAdmin.delete("/uiimage/:category/:id", (req, res) => {

            let params = {
                id: req.params.id,
                category: req.params.category
            };

            fileInterface.deleteFile(params, (err, result) => {
                if (err) {
                    res.status(err.cod).send(err).end();
                    return;
                }

                res.status(result.cod).end();

            });

        }); //--> DELETE /uiimage/'category'/'id'

        ///------> API

        var group = RED.nodes.getNode(config.group);

        if (!group) {
            return;
        }

        var tab = null;

        if (config.templateScope !== 'global') {
            tab = RED.nodes.getNode(group.config.tab);
            if (!tab) {
                return;
            }
            if (!config.width) {
                config.width = group.config.width;
            }
        }

        var previousTemplate = null

        //--> Lado a Lado - background-repeat: repeat
        //--> Ajustar (Centralizar imagem Inteira) - background-position: center
        //--> Centralizar (centro da imagem) - background-size: 100%; + background-position: center;
        //--> Ampliar (estica a imagem) - size = cover

        image = "<div ng-style=\"msg.image\"></div>";

        if (config.layout === 'adjust') {

            // console.log("--> adjust");

            defines = {};

            defines = {
                'width': '100%',
                'height': '100%',
                'background-size': 'contain',
                'background-position': 'center',
                'background-repeat': 'no-repeat',
                'background-image': "url('" + config.path.path + "')"
            };

            if (currentImage != null) {
                node.emit('input', {
                    payload: null
                });
            }
        }

        if (config.layout === 'center') {

            // console.log("--> center");

            defines = {};

            defines = {
                'width': '100%',
                'height': '100%',
                'background-size': '100%',
                'background-position': 'center',
                'background-repeat': 'no-repeat',
                'background-image': "url('" + config.path.path + "')"
            };

            if (currentImage != null) {
                node.emit('input', {
                    payload: null
                });
            }
        }

        if (config.layout === 'expand') {

            // console.log("--> expand");            

            defines = {};

            defines = {
                'width': '100%',
                'height': '100%',
                'background-size': 'cover',
                'background-position': 'center',
                'background-repeat': 'no-repeat',
                'background-image': "url('" + config.path.path + "')"
            };

            if (currentImage != null) {
                node.emit('input', {
                    payload: null
                });
            }
        }

        if (config.layout === 'side') {

            // console.log("--> side"); 

            defines = {};

            defines = {
                'width': '100%',
                'height': '100%',
                'background-repeat': 'repeat',
                'background-image': "url('" + config.path.path + "')"
            };

            if (currentImage != null) {
                node.emit('input', {
                    payload: null
                });
            }

        }

        var done = ui.add({
            node: node,
            tab: tab,
            group: group,
            control: {
                type: 'template',
                width: config.width || 6,
                height: hei,
                format: image //config.format,
            },
            beforeEmit: function (msg, value) {

                // console.log("Chamou dentro beforeEmit - MSG: ", msg, " - value: ", value);

                if (msg.init != true) {
                    defines['background-image'] = "url('" + value + "')";
                    msg.image = defines;
                } else {
                    msg.image = value;
                }


                var properties = Object.getOwnPropertyNames(msg).filter(function (p) {
                    return p[0] != '_';
                });


                var clonedMsg = {
                    templateScope: config.templateScope
                };

                for (var i = 0; i < properties.length; i++) {
                    var property = properties[i];
                    clonedMsg[property] = msg[property];
                }

                // transform to string if msg.template is buffer
                if (clonedMsg.template !== undefined && Buffer.isBuffer(clonedMsg.template)) {
                    clonedMsg.template = clonedMsg.template.toString();
                }

                if (clonedMsg.template === undefined && previousTemplate !== null) {
                    clonedMsg.template = previousTemplate;
                }

                if (clonedMsg.template) {
                    previousTemplate = clonedMsg.template
                }

                return { //Return da função
                    msg: clonedMsg
                };

            }
        });

        node.emit('input', {
            init: true,
            payload: defines
        });

        node.on("close", done);
    }
    RED.nodes.registerType("ui_image", ImageNode);
};