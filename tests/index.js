/*
 * Poly2Tri Copyright (c) 2009-2013, Poly2Tri Contributors
 * http://code.google.com/p/poly2tri/
 *
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 * * Redistributions of source code must retain the above copyright notice,
 *   this list of conditions and the following disclaimer.
 * * Redistributions in binary form must reproduce the above copyright notice,
 *   this list of conditions and the following disclaimer in the documentation
 *   and/or other materials provided with the distribution.
 * * Neither the name of Poly2Tri nor the names of its contributors may be
 *   used to endorse or promote products derived from this software without specific
 *   prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/* jshint browser:true, forin:true, noarg:true, noempty:true, eqeqeq:true, 
 strict:true, undef:true, unused:true, curly:true, immed:true, latedef:true, 
 newcap:true, trailing:true, maxcomplexity:5, indent:4 
 */
/* global poly2tri, $ */


"use strict";

// Colors
var TRIANGLE_FILL_STYLE = "#e0c4ef";
var TRIANGLE_STROKE_STYLE = "#911ccd";
var CONSTRAINT_STYLE = "rgba(0,0,0,0.6)";
var ERROR_STYLE = "rgba(255,0,0,0.8)";


function clear() {
    $(".info").css('visibility', 'hidden');
    $("textarea").val("");
}

function parsePoints(str) {
    var floats = str.split(/[^-eE\.\d]+/).filter(function(val) {
        return val;
    }).map(parseFloat);
    var i, points = [];
    // bitwise 'and' to ignore any isolated float at the end
    /* jshint bitwise:false */
    for (i = 0; i < (floats.length & 0x7FFFFFFE); i += 2) {
        points.push(new poly2tri.Point(floats[i], floats[i + 1]));
    }
    return points;
}

function polygonPath(ctx, points) {
    ctx.beginPath();
    points.forEach(function(point, index) {
        if (index === 0) {
            ctx.moveTo(point.x, point.y);
        } else {
            ctx.lineTo(point.x, point.y);
        }
    });
    ctx.closePath();
}

function triangulate(ctx) {
    //
    var contour = [];
    var holes = [];
    var points = [];
    var bounds, xscale, yscale, scale, linescale;
    var error_points;
    var triangles;
    var swctx;

    // clear the canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    $(".info").css('visibility', 'visible');

    // parse contour
    contour = parsePoints($("textarea#poly_contour").val());
    $("#contour_size").text(contour.length);

    // parse holes
    $("textarea#poly_holes").val().split(/\n\s*\n/).forEach(function(val) {
        var hole = parsePoints(val);
        if (hole.length > 0) {
            holes.push(hole);
        }
    });
    $("#holes_size").text(holes.length);

    // parse points
    points = parsePoints($("textarea#poly_points").val());
    $("#points_size").text(points.length);

    try {
        // prepare SweepContext
        swctx = new poly2tri.SweepContext(contour, {cloneArrays: true});
        holes.forEach(function(hole) {
            swctx.addHole(hole);
        });
        swctx.addPoints(points);

        // triangulate
        swctx.triangulate();
    } catch (e) {
        window.alert(e);
        error_points = e.points;
    }
    triangles = swctx.getTriangles() || [];
    $("#triangles_size").text(triangles.length);

    // auto scale / translate
    bounds = swctx.getBoundingBox();
    xscale = ctx.canvas.width / (bounds.max.x - bounds.min.x);
    yscale = ctx.canvas.height / (bounds.max.y - bounds.min.y);
    scale = Math.min(xscale, yscale);
    ctx.scale(scale, scale);
    ctx.translate(-bounds.min.x, -bounds.min.y);
    linescale = (scale > 1) ? (1 / scale) : 1;

    // draw result
    ctx.lineWidth = linescale;
    ctx.fillStyle = TRIANGLE_FILL_STYLE;
    ctx.strokeStyle = TRIANGLE_STROKE_STYLE;
    ctx.setLineDash(null);

    triangles.forEach(function(t) {
        polygonPath(ctx, [t.getPoint(0), t.getPoint(1), t.getPoint(2)]);
        ctx.fill();
        ctx.stroke();
    });

    // draw constraints
    if ($("#draw_constraints").attr('checked')) {
        ctx.lineWidth = 4 * linescale;
        ctx.strokeStyle = CONSTRAINT_STYLE;
        ctx.fillStyle = CONSTRAINT_STYLE;
        ctx.setLineDash([10 * linescale, 5 * linescale]);

        polygonPath(ctx, contour);
        ctx.stroke();

        holes.forEach(function(hole) {
            polygonPath(ctx, hole);
            ctx.stroke();
        });

        points.forEach(function(point) {
            ctx.beginPath();
            ctx.arc(point.x, point.y, ctx.lineWidth, 0, 2 * Math.PI, false);
            ctx.closePath();
            ctx.fill();
        });
    }

    // highlight errors, if any
    if (error_points) {
        ctx.lineWidth = 4 * linescale;
        ctx.fillStyle = ERROR_STYLE;
        error_points.forEach(function(point) {
            ctx.beginPath();
            ctx.arc(point.x, point.y, ctx.lineWidth, 0, 2 * Math.PI, false);
            ctx.closePath();
            ctx.fill();
        });
    }
}

$(document).ready(function() {
    var $canvas = $('#canvas');
    var ctx = $canvas[0].getContext('2d');
    ctx.canvas.width  = $canvas.width();
    ctx.canvas.height = $canvas.height();

    if (typeof ctx.setLineDash === "undefined") {
        ctx.setLineDash = function(a) {
            ctx.mozDash = a;
        };
    }

    $("#btnTriangulate").click(function() { triangulate(ctx); });
    $("#btnClear").click(clear).click();

    // Default points
    $("#poly_contour").val("280.35714 648.79075,286.78571 662.8979,263.28607 661.17871,262.31092 671.41548,250.53571 677.00504,250.53571 683.43361,256.42857 685.21933,297.14286 669.50504,289.28571 649.50504,285 631.6479,285 608.79075,292.85714 585.21932,306.42857 563.79075,323.57143 548.79075,339.28571 545.21932,357.85714 547.36218,375 550.21932,391.42857 568.07647,404.28571 588.79075,413.57143 612.36218,417.14286 628.07647,438.57143 619.1479,438.03572 618.96932,437.5 609.50504,426.96429 609.86218,424.64286 615.57647,419.82143 615.04075,420.35714 605.04075,428.39286 598.43361,437.85714 599.68361,443.57143 613.79075,450.71429 610.21933,431.42857 575.21932,405.71429 550.21932,372.85714 534.50504,349.28571 531.6479,346.42857 521.6479,346.42857 511.6479,350.71429 496.6479,367.85714 476.6479,377.14286 460.93361,385.71429 445.21932,388.57143 404.50504,360 352.36218,337.14286 325.93361,330.71429 334.50504,347.14286 354.50504,337.85714 370.21932,333.57143 359.50504,319.28571 353.07647,312.85714 366.6479,350.71429 387.36218,368.57143 408.07647,375.71429 431.6479,372.14286 454.50504,366.42857 462.36218,352.85714 462.36218,336.42857 456.6479,332.85714 438.79075,338.57143 423.79075,338.57143 411.6479,327.85714 405.93361,320.71429 407.36218,315.71429 423.07647,314.28571 440.21932,325 447.71932,324.82143 460.93361,317.85714 470.57647,304.28571 483.79075,287.14286 491.29075,263.03571 498.61218,251.60714 503.07647,251.25 533.61218,260.71429 533.61218,272.85714 528.43361,286.07143 518.61218,297.32143 508.25504,297.85714 507.36218,298.39286 506.46932,307.14286 496.6479,312.67857 491.6479,317.32143 503.07647,322.5 514.1479,325.53571 521.11218,327.14286 525.75504,326.96429 535.04075,311.78571 540.04075,291.07143 552.71932,274.82143 568.43361,259.10714 592.8979,254.28571 604.50504,251.07143 621.11218,250.53571 649.1479,268.1955 654.36208");
    $("#poly_holes").val("325 437,320 423,329 413,332 423\n\n320.72342 480,338.90617 465.96863,347.99754 480.61584,329.8148 510.41534,339.91632 480.11077,334.86556 478.09046");
    $("#poly_points").val("363 379,368 374");
});

