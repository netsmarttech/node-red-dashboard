"use strict";

var formidable = require('formidable');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');

module.exports = function (RED) {
    var ui = require('../ui')(RED);

    function ImageNode(config) {

        RED.nodes.createNode(this, config);

        var node = this;
        var tab, elmStyle;
        var link = null,
            layout = 'adjust';

        var group = RED.nodes.getNode(config.group);

        if (!group) {
            return;
        }

        tab = RED.nodes.getNode(group.config.tab);
        if (!tab) {
            return;
        }
        if (!config.width) {
            config.width = group.config.width;
        }

        elmStyle = {
            'width': '100%',
            'height': '100%'
        };

        if (config.category && config.file) {
            link = '/uiimage/' + config.category + '/' + config.file;
        }
        if (config.layout) {
            layout = config.layout;
        }

        function processLayout(layout) {

            switch (layout) {

                case 'adjust': {
                    elmStyle['background-size'] = 'contain';
                    elmStyle['background-position'] = 'center';
                    elmStyle['background-repeat'] = 'no-repeat';
                    break;
                }

                case 'center': {
                    elmStyle['background-size'] = '';
                    elmStyle['background-position'] = 'center';
                    elmStyle['background-repeat'] = 'no-repeat';
                    break;
                }

                case 'expand': {
                    elmStyle['background-size'] = 'cover';
                    elmStyle['background-position'] = 'center';
                    elmStyle['background-repeat'] = 'no-repeat';
                    break;
                }

                case 'side': {
                    elmStyle['background-size'] = '';
                    elmStyle['background-position'] = '';
                    elmStyle['background-repeat'] = 'repeat';
                    break;
                }

                default: {
                    elmStyle['background-size'] = 'contain';
                    elmStyle['background-position'] = 'center';
                    elmStyle['background-repeat'] = 'no-repeat';
                    node.warn("Invalid Layout - " + layout);
                    break;
                }
            }
        }

        var done = ui.add({
            emitOnlyNewValues: false,
            node: node,
            tab: tab,
            group: group,
            control: {
                type: 'image',
                order: config.order,
                width: parseInt(config.width) || 6,
                height: parseInt(config.height) || parseInt(config.width) || 6,
                format: '{{msg.payload}}'
            },
            beforeEmit: function (msg) {

                //process current layout
                if (msg.layout !== undefined) {
                    layout = msg.layout;
                }
                processLayout(layout);

                //process current image
                if (msg.url !== undefined) {
                    link = msg.url;
                } else if (msg.payload !== undefined) {
                    if (typeof msg.payload === 'string') {
                        link = msg.payload ? '/uiimage/' + msg.payload : '';
                    } else if (msg.payload.category && msg.payload.name) {
                        link = '/uiimage/' + msg.payload.category + '/' + msg.payload.name;
                    }
                }
                elmStyle['background-image'] = link ? "url('" + link + "')" : ''

                return {
                    style: elmStyle
                }
            }
        });

        node.emit('input', {}); //triggers the configured image
        node.on("close", done);
    }
    RED.nodes.registerType("ui_image", ImageNode);


    var pathDir = path.join(RED.settings.userDir, "lib", "ui-image", "lib");
    var pathUpload = path.join(RED.settings.userDir, "lib", "ui-image", "upload");

    mkdirp(pathDir, (err) => {
        if (err) {
            console.log(err);
        }
    });

    mkdirp(pathUpload, (err) => {
        if (err) {
            console.log(err);
        }
    });

    ///------> API

    RED.httpAdmin.post('/uiimage/:category/:id', (req, res) => {

        var error = [];
        var success = [];

        var form = new formidable.IncomingForm();
        form.multiples = true;
        form.uploadDir = pathUpload;

        form.parse(req, function (err, fields, files) {

            var filesUpload = form.openedFiles.length;
            let category = sanitizeInput(req.params.category);
            let name;
            let extension;

            var pathBase = path.join(pathDir, category);

            var controlFiles = filesUpload;

            mkdirp(pathBase, (err) => {

                if (err) {
                    error.push({
                        cod: 500,
                        msg: err
                    });
                    return;
                }

                for (var i = 0; i < filesUpload; i++) {

                    name = files[i].name;

                    if (!(/\.(gif|jpg|jpeg|tiff|png)$/i).test(name)) {

                        error.push({
                            cod: 400,
                            msg: 'incompatible file'
                        });

                        controlFiles--;

                        return;
                    }

                    if (controlFiles == 0) {
                        if (error.length > 0) {
                            error.forEach(err => {
                                res.status(err.cod).send(err.msg).end();
                            });

                            return;
                        }
                        res.status(201).send(success[0]).end();
                    }

                    let oldpath = files[i].path;
                    let newpath = path.join(pathBase, files[i].name);

                    fs.rename(oldpath, newpath, function (err) {

                        controlFiles--;

                        if (err) {

                            error.push({
                                cod: 500,
                                msg: err
                            });
                            return;
                        }

                        pathExtern = path.join("/", "uiimage", category, name);
                        reference = category + "/" + name;

                        let obj = {
                            path: pathExtern,
                            ref: reference
                        };

                        success.push(obj);

                        if (controlFiles == 0) {
                            if (error.length > 0) {
                                error.forEach(err => {
                                    res.status(err.cod).send(err.msg).end();
                                });

                                return;
                            }
                            res.status(201).send(success[0]).end();
                        }
                    });
                }
            });
        });
    }); //--> POST /uiimage/'category'/'id'

    /**
     * Creates a category.Returns the list of current categories
     * @returns 200 - JSON with all the categories
     * @returns 500 - system error
     */
    //TODO: use the :category instead of a multpart form post
    RED.httpAdmin.post('/uiimage/:category', (req, res) => {

        let dirCategory = path.join(pathDir, sanitizeInput(req.params.category));

        mkdirp(dirCategory, (err) => {
            if (err) {
                res.status(500).send(err);
                return;
            }

            restListCategories(req, res);
        });
    }); //--> POST /uiimage/category/

    /**
     * Returns a list of categories
     * @returns 200 - JSON with all the categories
     * @returns 500 - system error
     */
    function restListCategories(req, res) {

        let responseDone = false

        function doResponse(code, data) {
            if (responseDone) {
                return;
            }
            responseDone = true;

            res.status(code);
            if (data) {
                res.json(data);
            }
            res.end();
        }

        fs.readdir(pathDir, 'utf-8', (err, files) => {

            if (err) {
                doResponse(500, err);
                return;
            }

            var response = [];
            var listCategory = [];

            var numFiles = files.length;

            if (!numFiles) {
                doResponse(200, response);
                return;
            }

            files.forEach(file => {

                var dirFile = path.join(pathDir, file);

                fs.stat(dirFile, (err, stat) => {
                    if (err) {
                        doResponse(500, err);
                        return;
                    }

                    numFiles--;

                    if (stat.isDirectory()) {
                        response.push(file);
                    }

                    if (numFiles === 0) {
                        doResponse(200, response);
                    }
                });
            });
        });
    } //--> GET /uiimage
    RED.httpAdmin.get("/uiimage", restListCategories);

    /**
     * Gets a JSON with the content of a category
     * @returns 200 - JSON with all the images inside this category
     * @returns 404 - category not found
     * @returns 500 - system error
     */
    RED.httpAdmin.get("/uiimage/:category", (req, res) => {

        let pathCategory = path.join(pathDir, sanitizeInput(req.params.category));

        listFilesDir(pathCategory, (err, files) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    res.status(404).end();
                } else {
                    res.status(500).json(err).end();
                }
                return;
            }

            res.status(200).json(files).end();
        });

    }); //--> GET /uiimage/:category/images/

    /**
     * Gets the specified image
     * @returns 200 - the image
     * @returns 404 - image not found
     */
    RED.httpAdmin.get("/uiimage/:category/:id", (req, res) => {

        let id = sanitizeInput(req.params.id);
        let category = sanitizeInput(req.params.category);

        var pathImage = path.join(pathDir, category, id);

        fs.access(pathImage, (err) => {
            if (err) {
                res.status(404).json(err).end();
                return;
            }

            res.setHeader('Content-Type', 'image/*');
            fs.createReadStream(pathImage).pipe(res);
        });

    }); //--> GET /uiimage/'category'/'id'

    /**
     * Deletes an image inside a category
     * @returns 204 - OK
     * @returns 404 - image not found
     * @returns 500 - system error
     */
    RED.httpAdmin.delete("/uiimage/:category/:id", (req, res) => {

        let id = sanitizeInput(req.params.id);
        let category = sanitizeInput(req.params.category);

        var file = path.join(pathDir, category, id);

        fs.unlink(file, (err) => {

            if (err) {
                res.status(404).send(err).end();
                if (err.code === 'ENOENT') {
                    res.status(404).end();
                } else {
                    res.status(500).json(err).end();
                }
                return;
            }

            res.status(204).end();
            return;

        });
    }); //--> DELETE /uiimage/'category'/'id'

    /**
     * Deletes a category, and all images that it may contain
     * @returns 204 - OK
     * @returns 404 - category not found
     * @returns 500 - system error
     */
    RED.httpAdmin.delete("/uiimage/:category", (req, res) => {

        let categoryPath = path.join(pathDir, sanitizeInput(req.params.category));
        let responseDone = false;

        function doResponse(code, data) {
            if (responseDone) {
                return;
            }
            responseDone = true;

            res.status(code)
            if (data) {
                res.json(data);
            }
            res.end();
        }

        fs.readdir(categoryPath, 'utf-8', (err, files) => {

            if (err) {
                if (err.code === 'ENOENT') {
                    doResponse(404);
                } else {
                    doResponse(500, err);
                }
                return;
            }

            let contFiles = files.length;

            // remove folder if empty
            if (contFiles === 0) {
                fs.rmdir(categoryPath, (err) => {
                    if (err) {
                        console.log("Error: ", err);
                        doResponse(500, err);
                        return;
                    }

                    doResponse(204);
                });
                return;
            }

            files.forEach((file) => {
                let filePath = path.join(categoryPath, file);

                fs.unlink(filePath, (err) => {

                    contFiles--;

                    if (err) {
                        doResponse(500, err);
                        return;
                    }

                    if (contFiles === 0) {
                        fs.rmdir(categoryPath, (err) => {
                            if (err) {
                                doResponse(500, err);
                                return;
                            }

                            doResponse(204);
                        });
                    }
                });
            });
        });
    }); //--> DELETE /uiimage/'category'/'id'

    ///------> API

};

// list the files inside a directory
function listFilesDir(pathDir, cb) {

    let callbackDone = false;

    function doCallback(err, data) {
        if (callbackDone) {
            return;
        }
        callbackDone = true;
        cb(err, data);
    }

    let images = [];

    fs.readdir(pathDir, 'utf-8', (err, files) => {

        if (err) {
            doCallback(err, null);
            return;
        }

        let countFiles = files.length;

        if (countFiles === 0) {
            doCallback(null, images);
            return;
        }

        files.forEach(file => {

            fs.stat(path.join(pathDir, file), (err, stat) => {

                countFiles--;

                if (err) {
                    doCallback(err, null);
                    return;
                }

                if (!stat.isDirectory()) {
                    images.push(file);
                }

                if (countFiles === 0) {
                    doCallback(null, images);
                }

            });
        });
    });
}

// inspired on https://github.com/parshap/node-sanitize-filename
const sanitizeInput = (function (str) {
    const illegalRe = /[\/\?<>\\:\*\|":]/g;
    const controlRe = /[\x00-\x1f\x80-\x9f]/g;
    const reservedRe = /^\.+$/;
    const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
    const windowsTrailingRe = /[\. ]+$/;

    const replacement = '_';

    return function sanitizeInput(str) {

        return (str || "")
            .replace(illegalRe, replacement)
            .replace(controlRe, replacement)
            .replace(reservedRe, replacement)
            .replace(windowsReservedRe, replacement)
            .replace(windowsTrailingRe, replacement);
    }
})();
