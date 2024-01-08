const fs = require('fs');

class ItemHandler {
    constructor(
        romPath = __dirname + '/ff3.smc',

        ptr_itemData = 0x185000,
        ptr_nameData = 0x12B300,
        ptr_descPointers = 0x2D7AA0,
        // ptr_descData = 0x2D6400,
        // ptr_descDataEnd = 0x2D77A0
    ) {
        this.ROM = fs.readFileSync(romPath);

        this.ptr_itemData = ptr_itemData
        this.ptr_nameData = ptr_nameData
        this.ptr_descPointers = ptr_descPointers
        // this.ptr_descData = ptr_descData
        // this.ptr_descDataEnd = ptr_descDataEnd

        this.itemData = this.ROM.subarray(ptr_itemData, ptr_itemData + 256 * 30)
        this.nameData = this.ROM.subarray(ptr_nameData, ptr_nameData + 256 * 13)
        this.descPointers = this.ROM.subarray(ptr_descPointers, ptr_descPointers + 256 * 2)
        // this.descData = this.ROM.subarray(ptr_descData, ptr_descDataEnd)
    }

    getArrays() {
        const itemArray = []
        for (let i = 0; i < 256; i++) {
            let c = i * 30
            itemArray.push(this.itemData.subarray(c, c + 30))
        };

        const nameArray = []
        for (let i = 0; i < 256; i++) {
            let c = i * 13
            nameArray.push(this.nameData.subarray(c, c + 13))
        };

        const descPtrsArray = []
        for (let i = 0; i < 256; i++) {
            let c = i * 2
            descPtrsArray.push(this.descPointers.subarray(c, c + 2))
        };

        return {itemArray, nameArray, descPtrsArray}
    }

    saveArraysToRom(itemArray, nameArray, descPtrsArray) {
        this.itemData = Buffer.concat(itemArray);
        this.nameData = Buffer.concat(nameArray);
        this.descPointers = Buffer.concat(descPtrsArray);

        this.ROM.set(this.itemData, this.ptr_itemData)
        this.ROM.set(this.nameData, this.ptr_nameData)
        this.ROM.set(this.descPointers, this.ptr_descPointers)
    }

    copyItem(copyId, pasteId) {
        const {itemArray, nameArray, descPtrsArray} = this.getArrays()

        itemArray[pasteId] = itemArray[copyId];
        itemArray[pasteId] = itemArray[copyId];

        nameArray[pasteId] = nameArray[copyId];
        nameArray[pasteId] = nameArray[copyId];

        descPtrsArray[pasteId] = descPtrsArray[copyId];
        descPtrsArray[pasteId] = descPtrsArray[copyId];

        this.saveArraysToRom(itemArray, nameArray, descPtrsArray)
    }

    swapItem(id1, id2) {
        const {itemArray, nameArray, descPtrsArray} = this.getArrays()

        let aux = itemArray[id2]
        itemArray[id2] = itemArray[id1]
        itemArray[id1] = aux

        aux = nameArray[id2]
        nameArray[id2] = nameArray[id1]
        nameArray[id1] = aux

        aux = descPtrsArray[id2]
        descPtrsArray[id2] = descPtrsArray[id1]
        descPtrsArray[id1] = aux

        this.saveArraysToRom(itemArray, nameArray, descPtrsArray)
    }

    moveItem(fromId, toId) {
        const {itemArray, nameArray, descPtrsArray} = this.getArrays()

        itemArray.splice(toId, 0, itemArray.splice(fromId, 1)[0])
        nameArray.splice(toId, 0, nameArray.splice(fromId, 1)[0])
        descPtrsArray.splice(toId, 0, descPtrsArray.splice(fromId, 1)[0])

        this.saveArraysToRom(itemArray, nameArray, descPtrsArray)
    }

    saveAs(romPath) {
        fs.writeFileSync(romPath, this.ROM)
    }
}

const itemHandler = new ItemHandler(__dirname + '/ff3.smc')

itemHandler.moveItem(250, 0)
itemHandler.saveAs(__dirname + '/newff3.smc')
