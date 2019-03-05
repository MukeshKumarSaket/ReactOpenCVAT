import React from 'react';
import './style.css';
import $ from 'jquery';
import platform from './platform';
import Logger from './logger';
import {showMessage,  createExportContainer} from './base';
import {serverRequest} from './server';
import LabelsInfo from './labelsinfo';
import CoordinateTranslator from './coordinateTranslator';
import {PlayerModel,PlayerController,PlayerView} from './player';
import Config from './userConfig';
import {IncrementIdGenerator, ConstIdGenerator} from './idGenerator';
import AnnotationParser from './annotationParser';
import {ShapeCollectionModel, ShapeCollectionController, ShapeCollectionView} from './shapeCollection';
import {ShapeBufferModel, ShapeBufferController, ShapeBufferView} from './shapeBuffer';
import {ShapeCreatorModel, ShapeCreatorController, ShapeCreatorView} from './shapeCreator';
import { PolyshapeEditorModel,PolyshapeEditorController,PolyshapeEditorView} from './polyshapeEditor';
import {PolyShapeModel, buildShapeModel, buildShapeController, buildShapeView, PolyShapeView} from './shapes';
import { ShapeMergerModel, ShapeMergerController, ShapeMergerView} from './shapeMerger';
import {ShapeGrouperModel, ShapeGrouperController, ShapeGrouperView} from './shapeGrouper';
import {AAMModel, AAMController, AAMView, AAMUndefinedKeyword} from './attributeAnnotationMode';

function buildAnnotationUI(job, shapeData, loadJobEvent) {
    console.log(' build annotation is callig ...........', job, shapeData)
    // Setup some API
    window.cvat = {
        labelsInfo: new LabelsInfo(job),
        translate: new CoordinateTranslator(),
        player: {
            geometry: {
                scale: 1,
            },
            frames: {
                current: job.start,
                start: job.start,
                stop: job.stop,
            }
        },
        mode: null,
        job: {
            z_order: job.z_order,
            id: job.jobid,
            images: job.image_meta_data,
        },
        search: {
            value: window.location.search,

            set: function(name, value) {
                let searchParams = new URLSearchParams(this.value);

                if (typeof value === 'undefined' || value === null) {
                    if (searchParams.has(name)) {
                        searchParams.delete(name);
                    }
                }
                else searchParams.set(name, value);
                this.value = `${searchParams.toString()}`;
            },

            get: function(name) {
                try {
                    let decodedURI = decodeURIComponent(this.value);
                    let urlSearchParams = new URLSearchParams(decodedURI);
                    if (urlSearchParams.has(name)) {
                        return urlSearchParams.get(name);
                    }
                    else return null;
                }
                catch (error) {
                    showMessage('Bad URL has been found');
                    this.value = window.location.href;
                    return null;
                }
            },

            toString: function() {
                return `${window.location.origin}/?${this.value}`;
            }
        }
    };

    // Remove external search parameters from url
    window.history.replaceState(null, null, `${window.location.origin}/?id=${job.jobid}`);

    window.cvat.config = new Config();

    // Setup components
    let idGenerator = new IncrementIdGenerator(job.max_shape_id + 1);
    let annotationParser = new AnnotationParser(job, window.cvat.labelsInfo, idGenerator);

    let shapeCollectionModel = new ShapeCollectionModel(idGenerator).import(shapeData, true);
    let shapeCollectionController = new ShapeCollectionController(shapeCollectionModel);
    let shapeCollectionView = new ShapeCollectionView(shapeCollectionModel, shapeCollectionController);

    // In case of old tasks that dont provide max saved shape id properly
    if (job.max_shape_id === -1) {
        idGenerator.reset(shapeCollectionModel.maxId + 1);
    }

    window.cvat.data = {
        get: () => shapeCollectionModel.exportAll(),
        set: (data) => {
            shapeCollectionModel.empty();
            shapeCollectionModel.import(data, false);
            shapeCollectionModel.update();
        },
        clear: () => shapeCollectionModel.empty(),
    };

    let shapeBufferModel = new ShapeBufferModel(shapeCollectionModel);
    let shapeBufferController = new ShapeBufferController(shapeBufferModel);
    let shapeBufferView = new ShapeBufferView(shapeBufferModel, shapeBufferController);

    $('#shapeModeSelector').prop('value', job.mode);
    let shapeCreatorModel = new ShapeCreatorModel(shapeCollectionModel, job);
    let shapeCreatorController = new ShapeCreatorController(shapeCreatorModel);
    let shapeCreatorView = new ShapeCreatorView(shapeCreatorModel, shapeCreatorController);

    let polyshapeEditorModel = new PolyshapeEditorModel();
    let polyshapeEditorController = new PolyshapeEditorController(polyshapeEditorModel);
    let polyshapeEditorView = new PolyshapeEditorView(polyshapeEditorModel, polyshapeEditorController);

    // Add static member for class. It will be used by all polyshapes.
    PolyShapeView.editor = polyshapeEditorModel;

    let shapeMergerModel = new ShapeMergerModel(shapeCollectionModel);
    let shapeMergerController = new ShapeMergerController(shapeMergerModel);
    new ShapeMergerView(shapeMergerModel, shapeMergerController);

    let shapeGrouperModel = new ShapeGrouperModel(shapeCollectionModel);
    let shapeGrouperController = new ShapeGrouperController(shapeGrouperModel);
    let shapeGrouperView = new ShapeGrouperView(shapeGrouperModel, shapeGrouperController);

    let aamModel = new AAMModel(shapeCollectionModel, (xtl, xbr, ytl, ybr) => {
        playerModel.focus(xtl, xbr, ytl, ybr);
    }, () => {
        playerModel.fit();
    });
    let aamController = new AAMController(aamModel);
    new AAMView(aamModel, aamController);

    shapeCreatorModel.subscribe(shapeCollectionModel);
    shapeGrouperModel.subscribe(shapeCollectionView);
    shapeCollectionModel.subscribe(shapeGrouperModel);

    $('#playerProgress').css('width', $('#player')["0"].clientWidth - 420);

    let playerGeometry = {
        width: $('#playerFrame').width(),
        height: $('#playerFrame').height(),
    };

    let playerModel = new PlayerModel(job, playerGeometry);
    let playerController = new PlayerController(playerModel,
        () => shapeCollectionModel.activeShape,
        (direction) => shapeCollectionModel.find(direction),
        Object.assign({}, playerGeometry, {
            left: $('#playerFrame').offset().left,
            top: $('#playerFrame').offset().top,
        }), job);
    new PlayerView(playerModel, playerController, job);

    // let historyModel = new HistoryModel(playerModel);
    // let historyController = new HistoryController(historyModel);
    // new HistoryView(historyController, historyModel);

    // playerModel.subscribe(shapeCollectionModel);
    // playerModel.subscribe(shapeCollectionView);
    // playerModel.subscribe(shapeCreatorView);
    // playerModel.subscribe(shapeBufferView);
    // playerModel.subscribe(shapeGrouperView);
    // playerModel.subscribe(polyshapeEditorView);
    // playerModel.shift(window.cvat.search.get('frame') || 0, true);

    // let shortkeys = window.cvat.config.shortkeys;

    // setupHelpWindow(shortkeys);
    // setupSettingsWindow();
    // setupMenu(job, shapeCollectionModel, annotationParser, aamModel, playerModel, historyModel);
    // setupFrameFilters();
    // setupShortkeys(shortkeys, {
    //     aam: aamModel,
    //     shapeCreator: shapeCreatorModel,
    //     shapeMerger: shapeMergerModel,
    //     shapeGrouper: shapeGrouperModel,
    //     shapeBuffer: shapeBufferModel,
    //     shapeEditor: polyshapeEditorModel
    // });

    // $(window).on('click', function(event) {
    //     Logger.updateUserActivityTimer();
    //     if (event.target.classList.contains('modal')) {
    //         event.target.classList.add('hidden');
    //     }
    // });

    // let totalStat = shapeCollectionModel.collectStatistic()[1];
    // loadJobEvent.addValues({
    //     'track count': totalStat.boxes.annotation + totalStat.boxes.interpolation +
    //         totalStat.polygons.annotation + totalStat.polygons.interpolation +
    //         totalStat.polylines.annotation + totalStat.polylines.interpolation +
    //         totalStat.points.annotation + totalStat.points.interpolation,
    //     'frame count': job.stop - job.start + 1,
    //     'object count': totalStat.total,
    //     'box count': totalStat.boxes.annotation + totalStat.boxes.interpolation,
    //     'polygon count': totalStat.polygons.annotation + totalStat.polygons.interpolation,
    //     'polyline count': totalStat.polylines.annotation + totalStat.polylines.interpolation,
    //     'points count': totalStat.points.annotation + totalStat.points.interpolation,
    // });
    // loadJobEvent.close();

    // window.onbeforeunload = function(e) {
    //     if (shapeCollectionModel.hasUnsavedChanges()) {
    //         let message = "You have unsaved changes. Leave this page?";
    //         e.returnValue = message;
    //         return message;
    //     }
    //     return;
    // };

    // $('#player').on('click', (e) => {
    //     if (e.target.tagName.toLowerCase() != 'input') {
    //         blurAllElements();
    //     }
    // });
}
function initLogger(jobID) {
    console.log(' intilogger is calling .....')
    if (!Logger.initializeLogger('CVAT', jobID))
    {
        let message = 'Could not initialize Logger. Please immediately report the problem to support team';
        console.error(message);
        showMessage(message);
        return;
    }

    Logger.setTimeThreshold(Logger.EventType.zoomImage);
    serverRequest('/get/username', function(response) {
        Logger.setUsername(response.username);
    });
}
function callAnnotationUI(jid) {
    console.log(' call annotation ui is calling .........', jid)
    initLogger(jid);
    let loadJobEvent = Logger.addContinuedEvent(Logger.EventType.loadJob);
    var getJob = "https://c.onepanel.io/onepanel-demo/projects/cvat-public-demo/workspaces/cvat-gpu-demo-3/label/get/job/";
    var getAnnotationJob = "https://c.onepanel.io/onepanel-demo/projects/cvat-public-demo/workspaces/cvat-gpu-demo-3/label/get/annotation/job/";
    
    //buildAnnotationUI({},{});
    var getJobData = {
        "status": "Annotate",
        "labels": {
            "238": "CID",
            "239": "1,CID",
            "240": "2,CID",
            "241": "3,CID",
            "242": "4,CID",
            "243": "5,CID",
            "244": "6,CID",
            "245": "7,CID",
            "246": "8,CID",
            "247": "9,CID",
            "248": "10,Ego",
            "249": "lane"
        },
        "stop": 0,
        "taskid": 123,
        "slug": "File 1a",
        "jobid": 114,
        "start": 0,
        "mode": "annotation",
        "overlap": 0,
        "attributes": {
            "238": {},
            "239": {},
            "240": {},
            "241": {},
            "242": {},
            "243": {},
            "244": {},
            "245": {},
            "246": {},
            "247": {},
            "248": {},
            "249": {}
        },
        "z_order": false,
        "flipped": false,
        "image_meta_data": {
            "original_size": [
                {
                    "width": 1824,
                    "height": 864
                }
            ]
        }
    }
    var getAnnotationJobData = {
        "boxes": [],
        "box_paths": [],
        "polygons": [],
        "polygon_paths": [],
        "polylines": [],
        "polyline_paths": [],
        "points": [],
        "points_paths": []
    }

    buildAnnotationUI(getJobData, getAnnotationJobData, loadJobEvent);

    // serverRequest(getJob + jid, function(job) {
    //     serverRequest(getAnnotationJob + jid, function(data) {
    //         $('#loadingOverlay').remove();
    //         setTimeout(() => {
    //             buildAnnotationUI(job, data, loadJobEvent);
    //         }, 0);
    //     });
    // });
}

export default class App extends React.Component{
    componentDidMount() {
        String.prototype.normalize = function() {
            let target = this;
            target = target.charAt(0).toUpperCase() + target.substr(1);
            return target;
        };
        
        window.onload = function() {
            window.onerror = function(errorMsg, url, lineNumber, colNumber, error) {
                Logger.sendException({
                    message: errorMsg,
                    filename: url,
                    line: lineNumber,
                    column: colNumber ? colNumber : '',
                    stack: error && error.stack ? error.stack : '',
                    browser: platform.name + ' ' + platform.version,
                    os: platform.os.toString(),
                }).catch(() => { return; });
            };
        
            //let id = window.location.href.match('id=[0-9]+')[0].slice(3);
            let id = '114';
            callAnnotationUI(id);
        };
      }
render(){
        return(
<div id="taskAnnotationCenterPanel" style={{marginTop:"10px"}}>
    <div id="player">
        <div id="playerFrame">
            {/* <svg id="frameLoadingAnim" style={{width: "100%", height: "100%"}} >
                <circle r="30" cx="50%" cy="50%" id="frameLoadingAnimation"/>
            </svg> */}
            {/* <svg id="frameContent"> </svg> */}
            <svg id="frameBackground"> </svg>
            <svg id="frameGrid" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="playerGridPattern" width="100" height="100" patternUnits="userSpaceOnUse">
                        <path id="playerGridPath" d="M 1000 0 L 0 0 0 1000" fill="none" stroke="white" opacity="0" stroke-width="2"/>
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#playerGridPattern)" />
            </svg>

            <ul id="shapeContextMenu" className='custom-menu' oncontextmenu="return false;">
                <li action="object_url"> Copy Object URL </li>
                <li action="change_color"> Change Color </li>
                <li action="remove_shape"> Remove Shape </li>
                <li action="switch_occluded"> Switch Occluded </li>
                <li action="switch_lock"> Switch Lock </li>
                <li className="interpolationItem" action="split_track"> Split </li>
                <li className="polygonItem" action="drag_polygon"> Enable Dragging </li>
            </ul>

            <ul id="playerContextMenu" className='custom-menu' oncontextmenu="return false;">
                <li action="job_url"> Copy Job URL </li>
                <li action="frame_url"> Copy Frame URL </li>
            </ul>

            <ul id="pointContextMenu" className='custom-menu' oncontextmenu="return false;">
                <li action="remove_point"> Remove </li>
            </ul>
        </div>
        
        <div id="playerPanel">
            <svg id="firstButton" className="playerButton">
                <polygon points="100,0 100,80 75,60 75,80 50,60, 50,80 0,40 50,0 50,20 75,0 75,20" transform="scale(0.4)"/>
            </svg>
            <svg id="multiplePrevButton" className="playerButton">
                <polygon points="100,0 100,80 75,60 75,80 25,40 75,0 75,20" transform="scale(0.4)"/>
            </svg>

            <svg id="prevButton" className="playerButton">
                <polygon points="90,20 90,60 50,60 50,80 10,40 50,0 50,20" transform="scale(0.4)"/>
            </svg>

            <svg id="playButton" className="playerButton">
                <polygon points="35,0 35,80 85,40" transform="scale(0.4)"/>
            </svg>

            <svg id="pauseButton" className="playerButton hidden">
                <rect x="25" y="0" width="20" height="80" transform="scale(0.4)" />
                <rect x="65" y="0" width="20" height="80" transform="scale(0.4)" />
            </svg>

            <svg id="nextButton" className="playerButton">
                <polygon points="10,20 10,60 50,60 50,80 90,40 50,0 50,20" transform="scale(0.4)"/>
            </svg>

            <svg id="multipleNextButton" className="playerButton">
                <polygon points="1,1 1,80 25,60 25,80 75,40 25,0 25,20" transform="scale(0.4)"/>
            </svg>

            <svg id="lastButton" className="playerButton">
                <polygon points="1,1 1,80 25,60 25,80 50,60 50,80 100,40 50,0 50,20 25,0 25,20" transform="scale(0.4)"/>
            </svg>
            <input type = "range" id = "playerProgress"/>
        </div>  
        {/* <!-- END of PLAYER PANEL --> */}
    </div>
</div>
        )
    }
}
