dojo.provide("dojox.gfx.svg");

dojo.require("dojox.gfx._base");
dojo.require("dojox.gfx.shape");
dojo.require("dojox.gfx.path");

dojo.experimental("dojox.gfx.svg");

dojox.gfx.svg.xmlns = {
	xlink: "http://www.w3.org/1999/xlink",
	svg:   "http://www.w3.org/2000/svg"
};

dojox.gfx.svg.getRef = function(name){
	// summary: returns a DOM Node specified by the name argument or null
	// name: String: an SVG external reference 
	if(!name || name == "none") return null;
	if(name.match(/^url\(#.+\)$/)){
		return dojo.byId(name.slice(5, -1));	// Node
	}
	// alternative representation of a reference
	if(name.match(/^#dojoUnique\d+$/)){
		// we assume here that a reference was generated by dojox.gfx
		return dojo.byId(name.slice(1));	// Node
	}
	return null;	// Node
};

dojox.gfx.svg.dasharray = {
	solid:				"none",
	shortdash:			[4, 1],
	shortdot:			[1, 1],
	shortdashdot:		[4, 1, 1, 1],
	shortdashdotdot:	[4, 1, 1, 1, 1, 1],
	dot:				[1, 3],
	dash:				[4, 3],
	longdash:			[8, 3],
	dashdot:			[4, 3, 1, 3],
	longdashdot:		[8, 3, 1, 3],
	longdashdotdot:		[8, 3, 1, 3, 1, 3]
};

dojo.extend(dojox.gfx.Shape, {
	// summary: SVG-specific implementation of dojox.gfx.Shape methods
	
	setFill: function(fill){
		// summary: sets a fill object (SVG)
		// fill: Object: a fill object
		//	(see dojox.gfx.defaultLinearGradient, 
		//	dojox.gfx.defaultRadialGradient, 
		//	dojox.gfx.defaultPattern, 
		//	or dojo.Color)

		if(!fill){
			// don't fill
			this.fillStyle = null;
			this.rawNode.setAttribute("fill", "none");
			this.rawNode.setAttribute("fill-opacity", 0);
			return this;
		}
		var f;
		// FIXME: slightly magical. We're using the outer scope's "f", but setting it later
		var setter = function(x){
				// we assume that we're executing in the scope of the node to mutate
				this.setAttribute(x, f[x].toFixed(8));
			};
		if(typeof(fill) == "object" && "type" in fill){
			// gradient
			switch(fill.type){
				case "linear":
					f = dojox.gfx.makeParameters(dojox.gfx.defaultLinearGradient, fill);
					var gradient = this._setFillObject(f, "linearGradient");
					dojo.forEach(["x1", "y1", "x2", "y2"], setter, gradient);
					break;
				case "radial":
					f = dojox.gfx.makeParameters(dojox.gfx.defaultRadialGradient, fill);
					var gradient = this._setFillObject(f, "radialGradient");
					dojo.forEach(["cx", "cy", "r"], setter, gradient);
					break;
				case "pattern":
					f = dojox.gfx.makeParameters(dojox.gfx.defaultPattern, fill);
					var pattern = this._setFillObject(f, "pattern");
					dojo.forEach(["x", "y", "width", "height"], setter, pattern);
					break;
			}
			this.fillStyle = f;
			return this;
		}
		// color object
		var f = dojox.gfx.normalizeColor(fill);
		this.fillStyle = f;
		this.rawNode.setAttribute("fill", f.toCss());
		this.rawNode.setAttribute("fill-opacity", f.a);
		this.rawNode.setAttribute("fill-rule", "evenodd");
		return this;	// self
	},

	setStroke: function(stroke){
		// summary: sets a stroke object (SVG)
		// stroke: Object: a stroke object
		//	(see dojox.gfx.defaultStroke) 
	
		if(!stroke){
			// don't stroke
			this.strokeStyle = null;
			this.rawNode.setAttribute("stroke", "none");
			this.rawNode.setAttribute("stroke-opacity", 0);
			return this;
		}
		// normalize the stroke
		if(typeof stroke == "string"){
			stroke = {color: stroke};
		}
		var s = this.strokeStyle = dojox.gfx.makeParameters(dojox.gfx.defaultStroke, stroke);
		s.color = dojox.gfx.normalizeColor(s.color);
		// generate attributes
		var rn = this.rawNode;
		if(s){
			rn.setAttribute("stroke", s.color.toCss());
			rn.setAttribute("stroke-opacity", s.color.a);
			rn.setAttribute("stroke-width",   s.width);
			rn.setAttribute("stroke-linecap", s.cap);
			if(typeof s.join == "number"){
				rn.setAttribute("stroke-linejoin",   "miter");
				rn.setAttribute("stroke-miterlimit", s.join);
			}else{
				rn.setAttribute("stroke-linejoin",   s.join);
			}
			var da = s.style.toLowerCase();
			if(da in dojox.gfx.svg.dasharray){ da = dojox.gfx.svg.dasharray[da]; }
			if(da instanceof Array){
				da = dojo.clone(da);
				for(var i = 0; i < da.length; ++i){
					da[i] *= s.width;
				}
				if(s.cap != "butt"){
					for(var i = 0; i < da.length; i += 2){
						da[i] -= s.width;
						if(da[i] < 1){ da[i] = 1; }
					}
					for(var i = 1; i < da.length; i += 2){
						da[i] += s.width;
					}
				}
				da = da.join(",");
			}
			rn.setAttribute("stroke-dasharray", da);
			rn.setAttribute("dojoGfxStrokeStyle", s.style);
		}
		return this;	// self
	},
	
	_getParentSurface: function(){
		var surface = this.parent;
		for(; surface && !(surface instanceof dojox.gfx.Surface); surface = surface.parent);
		return surface;
	},

	_setFillObject: function(f, nodeType){
		var svgns = dojox.gfx.svg.xmlns.svg;
		this.fillStyle = f;
		var surface = this._getParentSurface();
		var defs = surface.defNode;
		var fill = this.rawNode.getAttribute("fill");
		var ref  = dojox.gfx.svg.getRef(fill);
		if(ref){
			fill = ref;
			if(fill.tagName.toLowerCase() != nodeType.toLowerCase()){
				var id = fill.id;
				fill.parentNode.removeChild(fill);
				fill = document.createElementNS(svgns, nodeType);
				fill.setAttribute("id", id);
				defs.appendChild(fill);
			}else{
				while(fill.childNodes.length){
					fill.removeChild(fill.lastChild);
				}
			}
		}else{
			fill = document.createElementNS(svgns, nodeType);
			fill.setAttribute("id", dojox.gfx._base._getUniqueId());
			defs.appendChild(fill);
		}
		if(nodeType == "pattern"){
			if(dojo.isSafari){
				fill.setAttributeNS(null, "patternUnits", "userSpaceOnUse");
			}else{
				fill.setAttribute("patternUnits", "userSpaceOnUse");
			}
			var img = document.createElementNS(svgns, "image");
			img.setAttribute("x", 0);
			img.setAttribute("y", 0);
			img.setAttribute("width",  f.width .toFixed(8));
			img.setAttribute("height", f.height.toFixed(8));
			img.setAttributeNS(dojox.gfx.svg.xmlns.xlink, "href", f.src);
			fill.appendChild(img);
		}else{
			if(dojo.isSafari){
				fill.setAttributeNS(null, "gradientUnits", "userSpaceOnUse");
			}else{
				fill.setAttribute("gradientUnits", "userSpaceOnUse");
			}
			for(var i = 0; i < f.colors.length; ++i){
				var c = f.colors[i], t = document.createElementNS(svgns, "stop"),
					cc = c.color = dojox.gfx.normalizeColor(c.color);
				t.setAttribute("offset",       c.offset.toFixed(8));
				t.setAttribute("stop-color",   cc.toCss());
				t.setAttribute("stop-opacity", cc.a);
				fill.appendChild(t);
			}
		}
		this.rawNode.setAttribute("fill", "url(#" + fill.getAttribute("id") +")");
		this.rawNode.removeAttribute("fill-opacity");
		this.rawNode.setAttribute("fill-rule", "evenodd");
		return fill;
	},
	
	_applyTransform: function() {
		var matrix = this.matrix;
		if(matrix){
			var tm = this.matrix;
			this.rawNode.setAttribute("transform", "matrix(" +
				tm.xx.toFixed(8) + "," + tm.yx.toFixed(8) + "," +
				tm.xy.toFixed(8) + "," + tm.yy.toFixed(8) + "," +
				tm.dx.toFixed(8) + "," + tm.dy.toFixed(8) + ")");
		}else{
			this.rawNode.removeAttribute("transform");
		}
		return this;
	},

	setRawNode: function(rawNode){
		// summary:
		//	assigns and clears the underlying node that will represent this
		//	shape. Once set, transforms, gradients, etc, can be applied.
		//	(no fill & stroke by default)
		var r = this.rawNode = rawNode;
		r.setAttribute("fill", "none");
		r.setAttribute("fill-opacity", 0);
		r.setAttribute("stroke", "none");
		r.setAttribute("stroke-opacity", 0);
		r.setAttribute("stroke-width", 1);
		r.setAttribute("stroke-linecap", "butt");
		r.setAttribute("stroke-linejoin", "miter");
		r.setAttribute("stroke-miterlimit", 4);
	},
	
	setShape: function(newShape){
		// summary: sets a shape object (SVG)
		// newShape: Object: a shape object
		//	(see dojox.gfx.defaultPath,
		//	dojox.gfx.defaultPolyline,
		//	dojox.gfx.defaultRect,
		//	dojox.gfx.defaultEllipse,
		//	dojox.gfx.defaultCircle,
		//	dojox.gfx.defaultLine,
		//	or dojox.gfx.defaultImage)
		this.shape = dojox.gfx.makeParameters(this.shape, newShape);
		for(var i in this.shape){
			if(i != "type"){ this.rawNode.setAttribute(i, this.shape[i]); }
		}
		return this;	// self
	},

	// move family

	_moveToFront: function(){
		// summary: moves a shape to front of its parent's list of shapes (SVG)
		this.rawNode.parentNode.appendChild(this.rawNode);
		return this;	// self
	},
	_moveToBack: function(){
		// summary: moves a shape to back of its parent's list of shapes (SVG)
		this.rawNode.parentNode.insertBefore(this.rawNode, this.rawNode.parentNode.firstChild);
		return this;	// self
	},
	
	_getRealMatrix: function(){
		var m = this.matrix;
		var p = this.parent;
		while(p){
			if(p.matrix){
				m = dojox.gfx.matrix.multiply(p.matrix, m);
			}
			p = p.parent;
		}
		return m;
	}
});

dojo.declare("dojox.gfx.Group", dojox.gfx.Shape, {
	// summary: a group shape (SVG), which can be used 
	//	to logically group shapes (e.g, to propagate matricies)
	constructor: function(){
		dojox.gfx.svg.Container._init.call(this);
	},
	setRawNode: function(rawNode){
		// summary: sets a raw SVG node to be used by this shape
		// rawNode: Node: an SVG node
		this.rawNode = rawNode;
	}
});
dojox.gfx.Group.nodeType = "g";

dojo.declare("dojox.gfx.Rect", dojox.gfx.shape.Rect, {
	// summary: a rectangle shape (SVG)
	setShape: function(newShape){
		// summary: sets a rectangle shape object (SVG)
		// newShape: Object: a rectangle shape object
		this.shape = dojox.gfx.makeParameters(this.shape, newShape);
		this.bbox = null;
		for(var i in this.shape){
			if(i != "type" && i != "r"){ this.rawNode.setAttribute(i, this.shape[i]); }
		}
		if(this.shape.r){
			this.rawNode.setAttribute("ry", this.shape.r);
			this.rawNode.setAttribute("rx", this.shape.r);
		}
		return this;	// self
	}
});
dojox.gfx.Rect.nodeType = "rect";

dojox.gfx.Ellipse = dojox.gfx.shape.Ellipse;
dojox.gfx.Ellipse.nodeType = "ellipse";

dojox.gfx.Circle = dojox.gfx.shape.Circle;
dojox.gfx.Circle.nodeType = "circle";

dojox.gfx.Line = dojox.gfx.shape.Line;
dojox.gfx.Line.nodeType = "line";

dojo.declare("dojox.gfx.Polyline", dojox.gfx.shape.Polyline, {
	// summary: a polyline/polygon shape (SVG)
	setShape: function(points, closed){
		// summary: sets a polyline/polygon shape object (SVG)
		// points: Object: a polyline/polygon shape object
		if(points && points instanceof Array){
			// branch
			// points: Array: an array of points
			this.shape = dojox.gfx.makeParameters(this.shape, { points: points });
			if(closed && this.shape.points.length){ 
				this.shape.points.push(this.shape.points[0]);
			}
		}else{
			this.shape = dojox.gfx.makeParameters(this.shape, points);
		}
		this.box = null;
		var attr = [];
		var p = this.shape.points;
		for(var i = 0; i < p.length; ++i){
			if(typeof p[i] == "number"){
				attr.push(p[i].toFixed(8));
			}else{
				attr.push(p[i].x.toFixed(8));
				attr.push(p[i].y.toFixed(8));
			}
		}
		this.rawNode.setAttribute("points", attr.join(" "));
		return this;	// self
	}
});
dojox.gfx.Polyline.nodeType = "polyline";

dojo.declare("dojox.gfx.Image", dojox.gfx.shape.Image, {
	// summary: an image (SVG)
	setShape: function(newShape){
		// summary: sets an image shape object (SVG)
		// newShape: Object: an image shape object
		this.shape = dojox.gfx.makeParameters(this.shape, newShape);
		this.bbox = null;
		var rawNode = this.rawNode;
		for(var i in this.shape){
			if(i != "type" && i != "src"){ rawNode.setAttribute(i, this.shape[i]); }
		}
		rawNode.setAttributeNS(dojox.gfx.svg.xmlns.xlink, "href", this.shape.src);
		return this;	// self
	},
	setStroke: function(){
		// summary: ignore setting a stroke style
		return this;	// self
	},
	setFill: function(){
		// summary: ignore setting a fill style
		return this;	// self
	}
});
dojox.gfx.Image.nodeType = "image";

dojo.declare("dojox.gfx.Text", dojox.gfx.shape.Text, {
	// summary: an anchored text (SVG)
	setShape: function(newShape){
		// summary: sets a text shape object (SVG)
		// newShape: Object: a text shape object
		this.shape = dojox.gfx.makeParameters(this.shape, newShape);
		this.bbox = null;
		var r = this.rawNode;
		var s = this.shape;
		r.setAttribute("x", s.x);
		r.setAttribute("y", s.y);
		r.setAttribute("text-anchor", s.align);
		r.setAttribute("text-decoration", s.decoration);
		r.setAttribute("rotate", s.rotated ? 90 : 0);
		r.setAttribute("kerning", s.kerning ? "auto" : 0);
		r.textContent = s.text;
		return this;	// self
	},
	getTextWidth: function(){ 
		// summary: get the text width in pixels 
		var rawNode = this.rawNode; 
		var oldParent = rawNode.parentNode; 
		var _measurementNode = rawNode.cloneNode(true); 
		_measurementNode.style.visibility = "hidden"; 

		// solution to the "orphan issue" in FF 
		var _width = 0; 
		var _text = _measurementNode.firstChild.nodeValue; 
		oldParent.appendChild(_measurementNode); 

		// solution to the "orphan issue" in Opera 
		// (nodeValue == "" hangs firefox) 
		if(_text!=""){ 
			while(!_width){ 
				_width = parseInt(_measurementNode.getBBox().width); 
			} 
		} 
		oldParent.removeChild(_measurementNode); 
		return _width; 
	} 
});
dojox.gfx.Text.nodeType = "text";

dojo.declare("dojox.gfx.Path", dojox.gfx.path.Path, {
	// summary: a path shape (SVG)
	_updateWithSegment: function(segment){
		// summary: updates the bounding box of path with new segment
		// segment: Object: a segment
		dojox.gfx.Path.superclass._updateWithSegment.apply(this, arguments);
		if(typeof(this.shape.path) == "string"){
			this.rawNode.setAttribute("d", this.shape.path);
		}
	},
	setShape: function(newShape){
		// summary: forms a path using a shape (SVG)
		// newShape: Object: an SVG path string or a path object (see dojox.gfx.defaultPath)
		dojox.gfx.Path.superclass.setShape.apply(this, arguments);
		this.rawNode.setAttribute("d", this.shape.path);
		return this;	// self
	}
});
dojox.gfx.Path.nodeType = "path";

dojo.declare("dojox.gfx.TextPath", dojox.gfx.path.TextPath, {
	// summary: a textpath shape (SVG)
	_updateWithSegment: function(segment){
		// summary: updates the bounding box of path with new segment
		// segment: Object: a segment
		dojox.gfx.Path.superclass._updateWithSegment.apply(this, arguments);
		this._setTextPath();
	},
	setShape: function(newShape){
		// summary: forms a path using a shape (SVG)
		// newShape: Object: an SVG path string or a path object (see dojox.gfx.defaultPath)
		dojox.gfx.Path.superclass.setShape.apply(this, arguments);
		this._setTextPath();
		return this;	// self
	},
	_setTextPath: function(){
		if(typeof this.shape.path != "string"){ return; }
		var r = this.rawNode;
		if(!r.firstChild){
			var tp = document.createElementNS(dojox.gfx.svg.xmlns.svg, "textPath");
			var tx = document.createTextNode("");
			tp.appendChild(tx);
			r.appendChild(tp);
		}
		var ref  = r.firstChild.getAttributeNS(dojox.gfx.svg.xmlns.xlink, "href");
		var path = ref && dojox.gfx.svg.getRef(ref);
		if(!path){
			var surface = this._getParentSurface();
			if(surface){
				var defs = surface.defNode;
				path = document.createElementNS(dojox.gfx.svg.xmlns.svg, "path");
				var id = dojox.gfx._base._getUniqueId();
				path.setAttribute("id", id);
				defs.appendChild(path);
				r.firstChild.setAttributeNS(dojox.gfx.svg.xmlns.xlink, "href", "#" + id);
			}
		}
		if(path){
			path.setAttribute("d", this.shape.path);
		}
	},
	_setText: function(){
		var r = this.rawNode;
		if(!r.firstChild){
			var tp = document.createElementNS(dojox.gfx.svg.xmlns.svg, "textPath");
			var tx = document.createTextNode("");
			tp.appendChild(tx);
			r.appendChild(tp);
		}
		r = r.firstChild;
		var t = this.text;
		r.setAttribute("alignment-baseline", "middle");
		switch(t.align){
			case "middle":
				r.setAttribute("text-anchor", "middle");
				r.setAttribute("startOffset", "50%");
				break;
			case "end":
				r.setAttribute("text-anchor", "end");
				r.setAttribute("startOffset", "100%");
				break;
			default:
				r.setAttribute("text-anchor", "start");
				r.setAttribute("startOffset", "0%");
				break;
		}
		//r.parentNode.setAttribute("alignment-baseline", "central");
		//r.setAttribute("dominant-baseline", "central");
		r.setAttribute("baseline-shift", "0.5ex");
		r.setAttribute("text-decoration", t.decoration);
		r.setAttribute("rotate", t.rotated ? 90 : 0);
		r.setAttribute("kerning", t.kerning ? "auto" : 0);
		r.firstChild.data = t.text;
	}
});
dojox.gfx.TextPath.nodeType = "text";

dojo.declare("dojox.gfx.Surface", dojox.gfx.shape.Surface, {
	// summary: a surface object to be used for drawings (SVG)
	constructor: function(){
		dojox.gfx.svg.Container._init.call(this);
	},
	setDimensions: function(width, height){
		// summary: sets the width and height of the rawNode
		// width: String: width of surface, e.g., "100px"
		// height: String: height of surface, e.g., "100px"
		if(!this.rawNode){ return this; }
		this.rawNode.setAttribute("width",  width);
		this.rawNode.setAttribute("height", height);
		return this;	// self
	},
	getDimensions: function(){
		// summary: returns an object with properties "width" and "height"
		return this.rawNode ? {width: this.rawNode.getAttribute("width"), height: this.rawNode.getAttribute("height")} : null; // Object
	}
});

dojox.gfx.createSurface = function(parentNode, width, height){
	// summary: creates a surface (SVG)
	// parentNode: Node: a parent node
	// width: String: width of surface, e.g., "100px"
	// height: String: height of surface, e.g., "100px"

	var s = new dojox.gfx.Surface();
	s.rawNode = document.createElementNS(dojox.gfx.svg.xmlns.svg, "svg");
	s.rawNode.setAttribute("width",  width);
	s.rawNode.setAttribute("height", height);

	var node = document.createElementNS(dojox.gfx.svg.xmlns.svg, "defs"); 
	s.rawNode.appendChild(node);
	s.defNode = node;
	
	dojo.byId(parentNode).appendChild(s.rawNode);
	return s;	// dojox.gfx.Surface
};

// Extenders

dojox.gfx.svg.Font = {
	_setFont: function(){
		// summary: sets a font object (SVG)
		var f = this.fontStyle;
		// next line doesn't work in Firefox 2 or Opera 9
		//this.rawNode.setAttribute("font", dojox.gfx.makeFontString(this.fontStyle));
		this.rawNode.setAttribute("font-style", f.style);
		this.rawNode.setAttribute("font-variant", f.variant);
		this.rawNode.setAttribute("font-weight", f.weight);
		this.rawNode.setAttribute("font-size", f.size);
		this.rawNode.setAttribute("font-family", f.family);
	}
};

dojox.gfx.svg.Container = {
	_init: function(){
		dojox.gfx.shape.Container._init.call(this);
	},
	add: function(shape){
		// summary: adds a shape to a group/surface
		// shape: dojox.gfx.Shape: an VML shape object
		if(this != shape.getParent()){
			this.rawNode.appendChild(shape.rawNode);
			//dojox.gfx.Group.superclass.add.apply(this, arguments);
			//this.inherited(arguments);
			dojox.gfx.shape.Container.add.apply(this, arguments);
		}
		return this;	// self
	},
	remove: function(shape, silently){
		// summary: remove a shape from a group/surface
		// shape: dojox.gfx.Shape: an VML shape object
		// silently: Boolean?: if true, regenerate a picture
		if(this == shape.getParent()){
			if(this.rawNode == shape.rawNode.parentNode){
				this.rawNode.removeChild(shape.rawNode);
			}
			//dojox.gfx.Group.superclass.remove.apply(this, arguments);
			//this.inherited(arguments);
			dojox.gfx.shape.Container.remove.apply(this, arguments);
		}
		return this;	// self
	},
	clear: function(){
		// summary: removes all shapes from a group/surface
		var r = this.rawNode;
		while(r.lastChild){
			r.removeChild(r.lastChild);
		}
		//return this.inherited(arguments);	// self
		return dojox.gfx.shape.Container.clear.apply(this, arguments);
	},
	_moveChildToFront: dojox.gfx.shape.Container._moveChildToFront,
	_moveChildToBack:  dojox.gfx.shape.Container._moveChildToBack
};

dojox.gfx.svg.Creator = {
	// summary: SVG shape creators
	createPath: function(path){
		// summary: creates an SVG path shape
		// path: Object: a path object (see dojox.gfx.defaultPath)
		return this.createObject(dojox.gfx.Path, path);	// dojox.gfx.Path
	},
	createRect: function(rect){
		// summary: creates an SVG rectangle shape
		// rect: Object: a path object (see dojox.gfx.defaultRect)
		return this.createObject(dojox.gfx.Rect, rect);	// dojox.gfx.Rect
	},
	createCircle: function(circle){
		// summary: creates an SVG circle shape
		// circle: Object: a circle object (see dojox.gfx.defaultCircle)
		return this.createObject(dojox.gfx.Circle, circle);	// dojox.gfx.Circle
	},
	createEllipse: function(ellipse){
		// summary: creates an SVG ellipse shape
		// ellipse: Object: an ellipse object (see dojox.gfx.defaultEllipse)
		return this.createObject(dojox.gfx.Ellipse, ellipse);	// dojox.gfx.Ellipse
	},
	createLine: function(line){
		// summary: creates an SVG line shape
		// line: Object: a line object (see dojox.gfx.defaultLine)
		return this.createObject(dojox.gfx.Line, line);	// dojox.gfx.Line
	},
	createPolyline: function(points){
		// summary: creates an SVG polyline/polygon shape
		// points: Object: a points object (see dojox.gfx.defaultPolyline)
		//	or an Array of points
		return this.createObject(dojox.gfx.Polyline, points);	// dojox.gfx.Polyline
	},
	createImage: function(image){
		// summary: creates an SVG image shape
		// image: Object: an image object (see dojox.gfx.defaultImage)
		return this.createObject(dojox.gfx.Image, image);	// dojox.gfx.Image
	},
	createText: function(text){
		// summary: creates an SVG text shape
		// text: Object: a text object (see dojox.gfx.defaultText)
		return this.createObject(dojox.gfx.Text, text);	// dojox.gfx.Text
	},
	createTextPath: function(text){
		// summary: creates an SVG text shape
		// text: Object: a textpath object (see dojox.gfx.defaultTextPath)
		return this.createObject(dojox.gfx.TextPath, {}).setText(text);	// dojox.gfx.TextPath
	},
	createGroup: function(){
		// summary: creates an SVG group shape
		return this.createObject(dojox.gfx.Group);	// dojox.gfx.Group
	},
	createObject: function(shapeType, rawShape){
		// summary: creates an instance of the passed shapeType class
		// shapeType: Function: a class constructor to create an instance of
		// rawShape: Object: properties to be passed in to the classes "setShape" method
		if(!this.rawNode){ return null; }
		var shape = new shapeType();
		var node = document.createElementNS(dojox.gfx.svg.xmlns.svg, shapeType.nodeType); 
		shape.setRawNode(node);
		this.rawNode.appendChild(node);
		shape.setShape(rawShape);
		this.add(shape);
		return shape;	// dojox.gfx.Shape
	},
	createShape: dojox.gfx._createShape
};

dojo.extend(dojox.gfx.Text, dojox.gfx.svg.Font);
dojo.extend(dojox.gfx.TextPath, dojox.gfx.svg.Font);

dojo.extend(dojox.gfx.Group, dojox.gfx.svg.Container);
dojo.extend(dojox.gfx.Group, dojox.gfx.svg.Creator);

dojo.extend(dojox.gfx.Surface, dojox.gfx.svg.Container);
dojo.extend(dojox.gfx.Surface, dojox.gfx.svg.Creator);
