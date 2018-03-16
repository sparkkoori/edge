exports.callRevs = function(revs){
	let _revs = []
	for (var i = revs.length-1; i >=0; i--) {
		let rev = revs[i]
		_revs.push(rev())
	}
	return ()=>exports.callRevs(_revs)
}

exports.emptyRev = function(){
	return ()=>exports.emptyRev()
}

exports.rgbToHex = function(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
