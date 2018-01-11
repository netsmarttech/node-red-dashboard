module.exports = function (RED) {
    var ui = require('../ui')(RED);
    var formidable = require('formidable');
    var fs = require('fs');
    var path = require('path');
    var mkdirp = require('mkdirp');

    function ImageNode(config) {

        RED.nodes.createNode(this, config);

        var node = this;

        var currentImage = null;

        var processImage = null;

        if (config.path === undefined) {
            config.path = {
                path: null,
                ref: null
            };
        }

        var hei = Number(config.height || 5);

        var image;

        var defines;

        var group = RED.nodes.getNode(config.group);

        if (!group) {
            return;
        }

        var tab = null;

        tab = RED.nodes.getNode(group.config.tab);
        if (!tab) {
            return;
        }
        if (!config.width) {
            config.width = group.config.width;
        }

        image = "<div ng-style=\"msg.image\"></div>";

        function defineLayout(layout) {

            defines = {};

            switch (layout) {

                case 'adjust':

                    defines = {
                        'width': '100%',
                        'height': '100%',
                        'background-size': 'contain',
                        'background-position': 'center',
                        'background-repeat': 'no-repeat',
                        'background-image': "url('" + config.path.path + "')"
                    };

                    break;

                case 'center':

                    defines = {
                        'width': '100%',
                        'height': '100%',
                        'background-position': 'center',
                        'background-repeat': 'no-repeat',
                        'background-image': "url('" + config.path.path + "')"
                    };

                    break;

                case 'expand':

                    defines = {
                        'width': '100%',
                        'height': '100%',
                        'background-size': 'cover',
                        'background-position': 'center',
                        'background-repeat': 'no-repeat',
                        'background-image': "url('" + config.path.path + "')"
                    };

                    break;

                case 'side':

                    defines = {
                        'width': '100%',
                        'height': '100%',
                        'background-repeat': 'repeat',
                        'background-image': "url('" + config.path.path + "')"
                    };

                    break;

                default:

                    defines = {
                        'width': '100%',
                        'height': '100%',
                        'background-size': 'contain',
                        'background-position': 'center',
                        'background-repeat': 'no-repeat',
                        'background-image': "url('" + config.path.path + "')"
                    };

                    node.warn("Invalid Layout - " + layout);

                    break;

            }

            if (currentImage != null) {
                node.emit('input', {
                    payload: null
                });
            }

        }

        defineLayout(config.layout);

        var done = ui.add({
            emitOnlyNewValues: false,
            node: node,
            tab: tab,
            group: group,
            control: {
                type: 'template',
                width: config.width || 6,
                height: hei,
                format: image
            },
            beforeEmit: function (msg, value) {

                let link;

                if (msg.payload !== undefined || msg.url !== undefined) {

                    if (typeof value === 'string') {
                        link = "/uiimage/" + value;
                    } else {
                        link = "/uiimage/" + value.category + "/" + value.name;
                    }

                    if (msg.url !== undefined) {
                        link = msg.url;
                    }

                    processImage = link;

                    if (msg.initialImage !== undefined) {
                        processImage = msg.initialImage;
                    }

                } else {
                    link = processImage;
                }

                if (msg.layout !== undefined) {
                    defineLayout(msg.layout);
                }

                if (msg.init != true) {
                    defines['background-image'] = "url('" + link + "')";
                    msg.image = defines;
                } else {
                    msg.image = value;
                }

                var properties = Object.getOwnPropertyNames(msg).filter(function (p) {
                    return p[0] != '_';
                });

                var clonedMsg = {};

                for (var i = 0; i < properties.length; i++) {
                    var property = properties[i];
                    clonedMsg[property] = msg[property];
                }

                return {
                    msg: clonedMsg
                };

            }
        });

        node.emit('input', {
            init: true,
            payload: defines,
            initialImage: config.path.path
        });

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
            let category = req.params.category;
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

    RED.httpAdmin.post('/uiimage/category/', (req, res) => {

        var form = new formidable.IncomingForm();

        form.multiples = true;

        form.uploadDir = pathUpload;

        form.parse(req, function (err, fields, files) {

            let category = fields.category;

            var pathBase = path.join(pathDir, category);

            mkdirp(pathBase, (err) => {
                if (err) {
                    res.status(500).send(err);
                    return;
                }

                res.status(201).send({
                    'category': category
                });
            });
        });
    }); //--> POST /uiimage/category/

    RED.httpAdmin.get("/uiimage", (req, res) => {

        fs.readdir(pathDir, 'utf-8', (err, files) => {

            if (err) {
                res.status(500).send(err).end();
                return;
            }

            var response = [];
            var listCategory = [];
            var listUncategorized = [];

            var numFiles = files.length;

            files.forEach(file => {

                var dirFile = path.join(pathDir, file);

                fs.stat(dirFile, (err, stat) => {
                    if (err) {
                        res.status(500).send(err).end();
                        return;
                    }

                    if (stat.isDirectory()) {

                        var category = file;
                        listCategory.push(category);

                        listFilesDir(dirFile, (err, files) => {
                            if (err) {
                                res.status(500).send(err).end();
                                return;
                            }

                            let obj = {
                                name: category,
                                list: files
                            };
                            response.push(obj);

                            numFiles--;

                            if (numFiles === 0) {
                                let obj = {
                                    object: response,
                                    listCat: listCategory
                                };

                                res.status(200).send(obj).end();
                                return;
                            }

                        });

                        return;
                    }

                    numFiles--;

                    if (numFiles === 0) {

                        let obj = {
                            object: response,
                            listCat: listCategory
                        };

                        res.status(200).send(obj).end();
                        return;
                    }

                });
            });
        });
    }); //--> GET /uiimage

    RED.httpAdmin.get("/uiimage/category/", (req, res) => {

        fs.readdir(pathDir, 'utf-8', (err, files) => {

            var categories = [];
            var numFiles = files.length;

            if (err) {
                res.status(500).send(err).end();
                return;
            }

            files.forEach(file => {

                var dirFile = path.join(pathDir, file);

                fs.stat(dirFile, (err, stat) => {
                    if (err) {
                        res.status(500).send(err).end();
                        return;
                    }

                    if (stat.isDirectory()) {
                        categories.push(file);
                    }

                    numFiles--;

                    if (numFiles === 0) {
                        res.status(200).json(categories).end();
                        return;
                    }
                });
            });
        });
    }); //--> GET /uiimage/category/

    RED.httpAdmin.get("/uiimage/:category/images/", (req, res) => {

        let pathCategory = path.join(pathDir, req.params.category);

        fs.stat(pathCategory, (err, stat) => {

            if (err) {
                res.status(500).send(err).end();
                return;
            }

            if (stat.isDirectory()) {
                listFilesDir(pathCategory, (err, files) => {
                    if (err) {
                        res.status(500).send(err).end();
                        return;
                    }

                    res.status(200).json(files).end();
                });
            }
        });
    }); //--> GET /uiimage/:category/images/

    RED.httpAdmin.get("/uiimage/:category/:id", (req, res) => {

        let id = req.params.id;
        let category = req.params.category;

        var pathImage = path.join(pathDir, category, id);

        fs.access(pathImage, (err) => {
            if (err) {
                res.status(404).send(err).end();
                return;
            }

            res.setHeader('Content-Type', 'image/*');
            fs.createReadStream(pathImage).pipe(res);
        });

    }); //--> GET /uiimage/'category'/'id'

    RED.httpAdmin.delete("/uiimage/:category/:id", (req, res) => {

        let id = req.params.id;
        let category = req.params.category;

        var file = path.join(pathDir, category, id);

        fs.unlink(file, (err) => {

            if (err) {
                res.status(404).send(err).end();
                return;
            }

            res.status(200).end();
            return;

        });
    }); //--> DELETE /uiimage/'category'/'id'

    RED.httpAdmin.delete("/uiimage/:category/", (req, res) => {

        let category = req.params.category;

        var categoryPath = path.join(pathDir, category);

        fs.readdir(categoryPath, 'utf-8', (err, files) => {

            if (err) {
                res.status(500).send(err);
                return;
            }

            var contFiles = files.length;

            if (contFiles === 0) {

                fs.rmdir(categoryPath, (err) => {
                    if (err) {
                        console.log("Error: ", err);
                        res.status(500).send(err);
                        return;
                    }

                    res.sendStatus(200);

                });
            }

            files.forEach((file) => {
                let filePath = path.join(categoryPath, file);

                fs.unlink(filePath, (err) => {

                    contFiles--;

                    if (err) {
                        return;
                    }

                    if (contFiles === 0) {

                        fs.rmdir(categoryPath, (err) => {
                            if (err) {
                                res.status(500).send(err);
                                return;
                            }

                            res.sendStatus(200);

                        });
                    }
                });
            });
        });
    }); //--> DELETE /uiimage/'category'/'id'

    ///------> API


    function listFilesDir(pathDir, cb) {

        let callbackDone = false;

        function doCallback(err, data) {
            if (callbackDone) return;
            callbackDone = true;
            cb(err, data);
        }

        let image = [];

        fs.readdir(pathDir, 'utf-8', (err, files) => {

            if (err) {
                doCallback(err, null);
                return;
            }

            let countFiles = files.length;

            if (countFiles === 0) {
                doCallback(null, image);
                return;
            }

            files.forEach(file => {

                fs.stat(path.join(pathDir, file), (err, stat) => {

                    if (err) {
                        doCallback(err, null);
                        return;
                    }

                    if (stat.isDirectory()) {
                        countFiles--;

                        if (countFiles === 0) {
                            doCallback(null, image);
                        }

                        return;
                    }

                    image.push(file);

                    countFiles--;

                    if (countFiles === 0) {
                        doCallback(null, image);
                    }

                });
            });
        });
    }
};