module.exports = {
  _before: function() { // 通用预处理器
  },
  /**
   * 云函数删除云存储文件
   * @param {Object} files 要删除的文件 url 组成的数组
   */
  async deleteCloudFile(files) {
    const deleteFiles = await uniCloud.deleteFile({
      fileList: files
    })
    return deleteFiles
  }
}